# MPH/VTK Simulation Viewer

A modern full-stack web application for uploading and visualizing simulation datasets in the browser.

This project is built for users who may not have COMSOL installed locally. It supports a practical workflow:

- Upload `.mph`, `.vtk`, `.vtu`, `.vtp`
- Server-side processing/conversion pipeline
- Interactive 3D visualization in browser using `vtk.js`
- Upload history so you can reopen past files without re-uploading

## Screenshots

### Upload + Recent History

![Upload Page](docs/screenshots/upload-page.png)

### Viewer - Case 1

![Viewer Screenshot 1](docs/screenshots/viewer-1.png)

### Viewer - Case 2

![Viewer Screenshot 2](docs/screenshots/viewer-2.png)

## Tech Stack

### Frontend

- Next.js 14 (App Router)
- TypeScript
- vtk.js
- Minimal custom UI (responsive, dark modern layout)

### Backend

- FastAPI
- Python 3.12+
- PyVista + meshio
- Local file storage (uploads, processed outputs, metadata)

## Project Structure

```text
mph/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   │   └── upload.py
│   │   └── services/
│   │       ├── converter.py
│   │       └── storage.py
│   └── data/
│       ├── uploads/
│       ├── processed/
│       └── meta/
├── frontend/
│   ├── app/
│   │   ├── upload/
│   │   └── viewer/[id]/
│   ├── components/
│   │   ├── FileUploader.tsx
│   │   ├── ControlsPanel.tsx
│   │   └── VTKViewer.tsx
│   └── next.config.mjs
└── docs/screenshots/
```

## Features

- Drag-and-drop file upload
- `.vtk/.vtu/.vtp` processing and browser rendering
- `.mph` accepted and tracked as `pending_conversion`
- 3D interaction: rotate, pan, zoom
- Scalar field selection
- Axes + bounding box toggles
- Basic analysis panel (min/max, points/cells/bounds)
- Recent uploads panel (quick reopen)
- Pending status polling in viewer

## Important Note About `.mph`

`.mph` is a proprietary COMSOL format and is not directly parseable in browser JavaScript.

Current behavior:

- `.mph` uploads are accepted and stored
- status is `pending_conversion`
- to visualize, export from COMSOL to `.vtk/.vtu/.vtp` and upload that file

## API Endpoints

### `POST /upload`

Accepts simulation file upload (`.mph`, `.vtk`, `.vtu`, `.vtp`) and returns metadata:

- `id`
- `status` (`ready` or `pending_conversion`)
- `message` (if pending)
- stats/scalars if ready

### `GET /file/{id}`

Returns metadata for a specific upload. If processed:

- `dataset_url`: `/file/{id}/dataset`

### `GET /file/{id}/dataset`

Returns processed VTP binary for the viewer.

### `GET /files?limit=50`

Returns recent uploads (history list), newest first.

## Local Setup

## 1) Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API docs:

- http://127.0.0.1:8000/docs

## 2) Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

App:

- http://127.0.0.1:3000

## Production Build

### Frontend

```bash
cd frontend
npm run build
npm run start
```

### Backend

```bash
cd backend
source .venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Performance Notes

- Upload writes are streamed to disk (better for large files)
- Viewer consumes processed surface data (`.vtp`)
- For very large meshes, decimation/LOD can be added in backend pipeline

## Roadmap Ideas

- Chunked/resumable uploads for very large files
- Delete/download actions in upload history
- Time-series playback for transient simulations
- Slice and cross-section tools
- Multi-file comparison mode

## License

MIT (or your preferred license)
# 3D-viewer-for-comsol-files
