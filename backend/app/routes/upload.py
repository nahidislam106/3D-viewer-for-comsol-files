from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Header, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.services.converter import convert_to_vtp
from app.services.storage import (
    find_upload_path,
    list_metas,
    load_meta,
    meta_path,
    new_file_id,
    processed_path,
    save_meta,
    save_upload_stream,
    upload_path,
    upload_tmp_path,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["files"])

_progress_lock = Lock()
_progress_events: dict[str, list[dict[str, object]]] = {}
_progress_done: dict[str, bool] = {}


def _set_progress(file_id: str, percent: int, message: str, *, done: bool = False) -> None:
    entry = {
        "percent": max(0, min(100, int(percent))),
        "message": message,
    }
    with _progress_lock:
        _progress_events.setdefault(file_id, []).append(entry)
        if done:
            _progress_done[file_id] = True


def _start_progress(file_id: str) -> None:
    with _progress_lock:
        _progress_events[file_id] = []
        _progress_done[file_id] = False


def _safe_suffix(filename: str) -> str:
    return filename.split(".")[-1].lower() if "." in filename else ""


def _validate_upload(file_id: str, filename: str) -> str:
    suffix = _safe_suffix(filename)
    if suffix not in {"mph", "vtk", "vtu", "vtp"}:
        logger.warning(f"[{file_id}] Rejected: unsupported suffix {suffix}")
        raise HTTPException(status_code=400, detail="Only .mph/.vtk/.vtu/.vtp are supported")
    return suffix


def _process_uploaded_file(file_id: str, filename: str, source_path: Path) -> dict:
    suffix = _validate_upload(file_id, filename)
    created_at = datetime.now(timezone.utc).isoformat()

    processing_payload = {
        "id": file_id,
        "filename": filename,
        "stored_filename": source_path.name,
        "created_at": created_at,
        "source_extension": f".{suffix}" if suffix else "",
        "status": "processing",
    }
    save_meta(file_id, processing_payload)
    _start_progress(file_id)

    try:
        conversion = convert_to_vtp(file_id, source_path, progress_callback=lambda p, m: _set_progress(file_id, p, m, done=p >= 100))
    except ValueError as exc:
        _set_progress(file_id, 100, str(exc), done=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        _set_progress(file_id, 100, f"Conversion failed: {exc}", done=True)
        logger.error(f"[{file_id}] Unexpected error: {type(exc).__name__}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {exc}") from exc

    payload = {
        "id": file_id,
        "filename": filename,
        "stored_filename": source_path.name,
        "created_at": created_at,
        "source_extension": f".{suffix}" if suffix else "",
        **conversion,
    }
    save_meta(file_id, payload)
    _set_progress(file_id, 100, "Done", done=True)
    return payload


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    x_chunk_index: int | None = Header(default=None, alias="X-Chunk-Index"),
    x_total_chunks: int | None = Header(default=None, alias="X-Total-Chunks"),
    x_file_id: str | None = Header(default=None, alias="X-File-Id"),
) -> dict:
    filename = file.filename or "upload.bin"
    is_chunked = x_chunk_index is not None or x_total_chunks is not None or x_file_id is not None

    if not is_chunked:
        file_id = new_file_id()
        logger.info(f"[{file_id}] Upload request: {filename}")
        _validate_upload(file_id, filename)
        source_path = save_upload_stream(file_id, filename, file.file)
        logger.info(f"[{file_id}] Saved to {source_path}, size: {source_path.stat().st_size} bytes")
        return _process_uploaded_file(file_id, filename, source_path)

    if x_chunk_index is None or x_total_chunks is None or x_file_id is None:
        raise HTTPException(status_code=400, detail="Chunked upload requires X-Chunk-Index, X-Total-Chunks, and X-File-Id")

    if x_total_chunks <= 0:
        raise HTTPException(status_code=400, detail="X-Total-Chunks must be > 0")
    if x_chunk_index < 0 or x_chunk_index >= x_total_chunks:
        raise HTTPException(status_code=400, detail="X-Chunk-Index out of range")

    try:
        UUID(x_file_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="X-File-Id must be a valid UUID") from exc

    file_id = x_file_id
    _validate_upload(file_id, filename)
    chunk_bytes = await file.read()
    temp_path = upload_tmp_path(file_id)

    with temp_path.open("ab") as out_file:
        out_file.write(chunk_bytes)

    logger.info(f"[{file_id}] Received chunk {x_chunk_index + 1}/{x_total_chunks} ({len(chunk_bytes)} bytes)")

    if x_chunk_index < x_total_chunks - 1:
        return {
            "status": "chunk_received",
            "id": file_id,
            "chunk_index": x_chunk_index,
            "total_chunks": x_total_chunks,
        }

    target_path = upload_path(file_id, filename)
    if target_path.exists():
        target_path.unlink()
    temp_path.replace(target_path)
    logger.info(f"[{file_id}] Final chunk received. Assembled upload at {target_path}")
    return _process_uploaded_file(file_id, filename, target_path)


@router.get("/file/{file_id}/progress")
async def file_progress(file_id: str) -> StreamingResponse:
    meta = load_meta(file_id)
    if meta is None and file_id not in _progress_events:
        raise HTTPException(status_code=404, detail="File not found")

    async def stream() -> AsyncGenerator[str, None]:
        sent = 0
        while True:
            with _progress_lock:
                events = list(_progress_events.get(file_id, []))
                done = _progress_done.get(file_id, False)

            while sent < len(events):
                yield f"data: {json.dumps(events[sent])}\n\n"
                sent += 1

            if done:
                break

            latest_meta = load_meta(file_id)
            if latest_meta is not None and latest_meta.get("status") in {"ready", "pending_conversion"} and sent == 0:
                fallback = {
                    "percent": 100,
                    "message": "Done",
                }
                yield f"data: {json.dumps(fallback)}\n\n"
                break

            await asyncio.sleep(0.25)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/file/{file_id}")
def get_file_meta(file_id: str) -> dict:
    meta = load_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="File not found")

    response = {
        **meta,
        "dataset_url": f"/file/{file_id}/dataset" if meta.get("status") == "ready" else None,
    }
    return response


@router.get("/files")
def list_files(limit: int = 50) -> dict:
    limit = max(1, min(limit, 200))
    items = list_metas(limit=limit)

    normalized = []
    for item in items:
        normalized.append(
            {
                **item,
                "dataset_url": f"/file/{item.get('id')}/dataset" if item.get("status") == "ready" else None,
            }
        )

    return {"items": normalized}


@router.get("/file/{file_id}/dataset")
def get_processed_dataset(file_id: str) -> FileResponse:
    meta = load_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="File not found")

    if meta.get("status") != "ready":
        raise HTTPException(status_code=409, detail="File is not converted yet")

    path = processed_path(file_id, ".vtp")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Processed dataset missing")

    return FileResponse(path, media_type="application/octet-stream", filename=path.name)


@router.get("/file/{file_id}/download")
def download_original_file(file_id: str) -> FileResponse:
    meta = load_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="File not found")

    path = find_upload_path(file_id, meta)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Original upload missing")

    filename = str(meta.get("filename") or path.name)
    return FileResponse(path, media_type="application/octet-stream", filename=filename)


@router.delete("/file/{file_id}")
def delete_file(file_id: str) -> dict[str, bool]:
    meta = load_meta(file_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="File not found")

    meta_file = meta_path(file_id)
    if meta_file.exists():
        meta_file.unlink()

    processed_file = processed_path(file_id, ".vtp")
    if processed_file.exists():
        processed_file.unlink()

    original = find_upload_path(file_id, meta)
    if original is not None and original.exists():
        original.unlink()

    tmp_file = upload_tmp_path(file_id)
    if tmp_file.exists():
        tmp_file.unlink()

    with _progress_lock:
        _progress_events.pop(file_id, None)
        _progress_done.pop(file_id, None)

    return {"success": True}
