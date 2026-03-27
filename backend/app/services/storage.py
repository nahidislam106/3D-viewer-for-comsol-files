from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO
from typing import Any
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"
META_DIR = DATA_DIR / "meta"

for directory in (UPLOAD_DIR, PROCESSED_DIR, META_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def new_file_id() -> str:
    return uuid4().hex


def save_upload(file_id: str, filename: str, content: bytes) -> Path:
    suffix = Path(filename).suffix.lower()
    stored_path = UPLOAD_DIR / f"{file_id}{suffix}"
    stored_path.write_bytes(content)
    return stored_path


def save_upload_stream(file_id: str, filename: str, stream: BinaryIO) -> Path:
    suffix = Path(filename).suffix.lower()
    stored_path = UPLOAD_DIR / f"{file_id}{suffix}"
    with stored_path.open("wb") as out_file:
        shutil.copyfileobj(stream, out_file, length=1024 * 1024)
    return stored_path


def processed_path(file_id: str, suffix: str = ".vtp") -> Path:
    return PROCESSED_DIR / f"{file_id}{suffix}"


def meta_path(file_id: str) -> Path:
    return META_DIR / f"{file_id}.json"


def save_meta(file_id: str, payload: dict[str, Any]) -> None:
    meta_path(file_id).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_meta(file_id: str) -> dict[str, Any] | None:
    path = meta_path(file_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_metas(limit: int = 100) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    meta_files = sorted(META_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)

    for path in meta_files[:limit]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue

        file_id = path.stem
        updated_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
        records.append(
            {
                "id": file_id,
                "updated_at": updated_at,
                **payload,
            }
        )

    return records
