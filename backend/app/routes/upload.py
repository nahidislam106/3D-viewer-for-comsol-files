from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.converter import convert_to_vtp
from app.services.storage import list_metas, load_meta, new_file_id, processed_path, save_meta, save_upload_stream

logger = logging.getLogger(__name__)
router = APIRouter(tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> dict:
    filename = file.filename or "upload.bin"
    suffix = filename.split(".")[-1].lower() if "." in filename else ""
    file_id = new_file_id()

    logger.info(f"[{file_id}] Upload request: {filename} (suffix={suffix})")

    if suffix not in {"mph", "vtk", "vtu", "vtp"}:
        logger.warning(f"[{file_id}] Rejected: unsupported suffix {suffix}")
        raise HTTPException(status_code=400, detail="Only .mph/.vtk/.vtu/.vtp are supported")

    logger.info(f"[{file_id}] Saving uploaded file to disk...")
    source_path = save_upload_stream(file_id, filename, file.file)
    logger.info(f"[{file_id}] Saved to {source_path}, size: {source_path.stat().st_size} bytes")

    try:
        logger.info(f"[{file_id}] Starting conversion process...")
        conversion = convert_to_vtp(file_id, source_path)
        logger.info(f"[{file_id}] Conversion result: status={conversion.get('status')}")
    except ValueError as exc:
        logger.error(f"[{file_id}] ValueError: {exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.error(f"[{file_id}] Unexpected error: {type(exc).__name__}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Conversion failed: {exc}") from exc

    payload = {
        "id": file_id,
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_extension": f".{suffix}" if suffix else "",
        **conversion,
    }

    logger.info(f"[{file_id}] Saving metadata...")
    save_meta(file_id, payload)
    logger.info(f"[{file_id}] Upload complete! Status: {payload.get('status')}")
    return payload


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
