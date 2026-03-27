from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pyvista as pv

from app.services.storage import processed_path

logger = logging.getLogger(__name__)


def _array_stats(values: np.ndarray) -> dict[str, float] | None:
    if values.size == 0:
        return None
    finite_values = values[np.isfinite(values)]
    if finite_values.size == 0:
        return None
    return {"min": float(np.min(finite_values)), "max": float(np.max(finite_values))}


def _collect_scalars(mesh: pv.DataSet) -> list[dict[str, Any]]:
    scalars: list[dict[str, Any]] = []

    for name in mesh.point_data.keys():
        array = mesh.point_data[name]
        if getattr(array, "ndim", 1) != 1:
            continue
        stats = _array_stats(np.asarray(array))
        if stats is None:
            continue
        scalars.append(
            {
                "name": name,
                "association": "point",
                "components": 1,
                **stats,
            }
        )

    for name in mesh.cell_data.keys():
        array = mesh.cell_data[name]
        if getattr(array, "ndim", 1) != 1:
            continue
        stats = _array_stats(np.asarray(array))
        if stats is None:
            continue
        scalars.append(
            {
                "name": name,
                "association": "cell",
                "components": 1,
                **stats,
            }
        )

    return scalars


def convert_to_vtp(file_id: str, source_path: Path) -> dict[str, Any]:
    suffix = source_path.suffix.lower()
    logger.info(f"[{file_id}] Starting conversion: {source_path.name} (suffix={suffix}, size={source_path.stat().st_size} bytes)")

    if suffix == ".mph":
        logger.warning(f"[{file_id}] .mph is proprietary format; returning pending_conversion")
        return {
            "status": "pending_conversion",
            "message": "Received .mph file. Export to .vtk/.vtu/.vtp from COMSOL to continue.",
        }

    if suffix not in {".vtk", ".vtu", ".vtp"}:
        logger.error(f"[{file_id}] Unsupported suffix: {suffix}")
        raise ValueError("Unsupported file type. Use .mph, .vtk, .vtu, or .vtp")

    try:
        logger.info(f"[{file_id}] Reading mesh with PyVista...")
        mesh = pv.read(source_path)
        logger.info(f"[{file_id}] Mesh loaded: {mesh.n_points} points, {mesh.n_cells} cells")

        logger.info(f"[{file_id}] Extracting and triangulating surface...")
        surface = mesh.extract_surface().triangulate()
        logger.info(f"[{file_id}] Surface ready: {surface.n_points} points, {surface.n_cells} cells")

        target_path = processed_path(file_id, ".vtp")
        logger.info(f"[{file_id}] Saving to {target_path}...")
        surface.save(target_path)
        logger.info(f"[{file_id}] Saved successfully; file size: {target_path.stat().st_size} bytes")

        bounds = [float(x) for x in surface.bounds]
        num_points = int(surface.n_points)
        num_cells = int(surface.n_cells)

        scalars = _collect_scalars(surface)
        logger.info(f"[{file_id}] Conversion complete; found {len(scalars)} scalar fields")

        return {
            "status": "ready",
            "processed_format": "vtp",
            "processed_filename": target_path.name,
            "stats": {
                "points": num_points,
                "cells": num_cells,
                "bounds": bounds,
            },
            "scalars": scalars,
        }
    except Exception as exc:
        logger.error(f"[{file_id}] Conversion error: {type(exc).__name__}: {exc}", exc_info=True)
        raise
