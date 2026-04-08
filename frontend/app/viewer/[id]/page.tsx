"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import ControlsPanel, { type ClipAxis, type ColormapName } from "@/components/ControlsPanel";
import VTKViewer from "@/components/VTKViewer";

type ScalarMeta = {
  name: string;
  association: "point" | "cell";
  min: number;
  max: number;
};

type FileMeta = {
  id: string;
  filename: string;
  source_extension?: string;
  status: "ready" | "pending_conversion" | "processing";
  message?: string;
  dataset_url: string | null;
  stats?: {
    points: number;
    cells: number;
    bounds: number[];
  };
  scalars: ScalarMeta[];
};

type ProgressPayload = {
  percent: number;
  message: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function ViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScalar, setActiveScalar] = useState("");
  const [colormap, setColormap] = useState<ColormapName>("Viridis");
  const [scalarRangeMin, setScalarRangeMin] = useState(0);
  const [scalarRangeMax, setScalarRangeMax] = useState(1);
  const [showAxes, setShowAxes] = useState(true);
  const [showBounds, setShowBounds] = useState(true);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipAxis, setClipAxis] = useState<ClipAxis>("x");
  const [clipPosition, setClipPosition] = useState(0);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  const activeScalarMeta = useMemo(() => {
    return meta?.scalars?.find((entry) => entry.name === activeScalar) ?? null;
  }, [meta, activeScalar]);

  const clipBounds = useMemo(() => {
    const bounds = meta?.stats?.bounds;
    if (!bounds || bounds.length < 6) {
      return null;
    }
    if (clipAxis === "x") {
      return { min: bounds[0], max: bounds[1] };
    }
    if (clipAxis === "y") {
      return { min: bounds[2], max: bounds[3] };
    }
    return { min: bounds[4], max: bounds[5] };
  }, [meta, clipAxis]);

  useEffect(() => {
    let cancelled = false;

    const fetchMeta = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/file/${id}`);
        const payload = (await response.json()) as FileMeta | { detail: string };

        if (!response.ok) {
          throw new Error("detail" in payload ? payload.detail : "Failed to fetch file metadata");
        }

        if (!cancelled) {
          const data = payload as FileMeta;
          setMeta(data);
          setActiveScalar(data.scalars?.[0]?.name ?? "");
          if (data.stats?.bounds && data.stats.bounds.length >= 6) {
            setClipPosition((data.stats.bounds[0] + data.stats.bounds[1]) * 0.5);
          }
        }
      } catch (metaError) {
        if (!cancelled) {
          const message = metaError instanceof Error ? metaError.message : "Metadata request failed";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (id) {
      fetchMeta();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!activeScalarMeta) {
      return;
    }
    setScalarRangeMin(activeScalarMeta.min);
    setScalarRangeMax(activeScalarMeta.max);
  }, [activeScalarMeta]);

  useEffect(() => {
    if (!clipBounds) {
      return;
    }
    const mid = (clipBounds.min + clipBounds.max) * 0.5;
    setClipPosition(mid);
  }, [clipBounds?.min, clipBounds?.max]);

  useEffect(() => {
    if (!id || !meta || meta.status === "ready") {
      return;
    }

    const source = new EventSource(`${API_BASE}/file/${id}/progress`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ProgressPayload;
        if (typeof payload.percent === "number" && typeof payload.message === "string") {
          setProgress(payload);
          if (payload.percent >= 100) {
            void (async () => {
              try {
                const response = await fetch(`${API_BASE}/file/${id}`);
                const data = (await response.json()) as FileMeta;
                if (response.ok) {
                  setMeta(data);
                  if (data.scalars?.length) {
                    setActiveScalar((prev) => prev || data.scalars[0].name);
                  }
                }
              } finally {
                source.close();
              }
            })();
          }
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [id, meta?.status]);

  const resetRange = () => {
    if (!activeScalarMeta) {
      return;
    }
    setScalarRangeMin(activeScalarMeta.min);
    setScalarRangeMax(activeScalarMeta.max);
  };

  const viewerContent = useMemo(() => {
    if (loading) {
      return <p style={{ color: "var(--text-1)" }}>Loading dataset metadata...</p>;
    }

    if (error) {
      return <p style={{ color: "var(--danger)" }}>{error}</p>;
    }

    if (!meta) {
      return <p style={{ color: "var(--text-1)" }}>No file metadata available.</p>;
    }

    if (meta.status !== "ready" || !meta.dataset_url) {
      return (
        <div className="card-note">
          <p style={{ margin: "0 0 0.8rem", color: "var(--text-0)", fontWeight: 600 }}>
            {meta.source_extension === ".mph" ? "📦 COMSOL Format Detected" : "⏳ Processing..."}
          </p>
          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            {meta.message ?? "Dataset conversion is pending."}
          </p>
          <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.4rem" }}>
            <div style={{ width: "100%", height: 10, borderRadius: 999, background: "rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(progress?.percent ?? 0, 100))}%`,
                  height: "100%",
                  background: "linear-gradient(120deg, var(--accent), var(--accent-2))",
                  transition: "width 180ms ease",
                }}
              />
            </div>
            <p className="mono" style={{ margin: 0, color: "var(--text-1)", fontSize: "0.85rem" }}>
              {progress ? `${Math.round(progress.percent)}% - ${progress.message}` : "Waiting for progress..."}
            </p>
          </div>
          {meta.source_extension === ".mph" && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--panel-border)" }}>
              <p style={{ margin: "0 0 0.6rem", color: "var(--text-0)", fontWeight: 600, fontSize: "0.95rem" }}>
                How to convert:
              </p>
              <div style={{ display: "grid", gap: "0.8rem", color: "var(--text-1)", fontSize: "0.9rem" }}>
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: 500 }}>Option 1: COMSOL (Recommended)</p>
                  <ol style={{ margin: "0", paddingLeft: "1.2rem" }}>
                    <li>Open file in COMSOL</li>
                    <li>File → Export → VTK format</li>
                    <li>Upload the .vtk file here</li>
                  </ol>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: 500 }}>Option 2: Online Converter</p>
                  <p style={{ margin: 0, color: "var(--accent)" }}>
                    Search for &quot;MPH to VTK converter online&quot; or use file conversion services
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: 500 }}>Option 3: Try Sample Data</p>
                  <p style={{ margin: 0 }}>
                    Download a sample VTK file from{" "}
                    <a href="https://github.com/naucoin/VTKData/tree/master/Data" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                      VTK data repository
                    </a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <VTKViewer
        datasetUrl={meta.dataset_url}
        activeScalar={activeScalar}
        colormap={colormap}
        scalarRangeMin={scalarRangeMin}
        scalarRangeMax={scalarRangeMax}
        showAxes={showAxes}
        showBounds={showBounds}
        clipEnabled={clipEnabled}
        clipAxis={clipAxis}
        clipPosition={clipPosition}
      />
    );
  }, [
    loading,
    error,
    meta,
    activeScalar,
    colormap,
    scalarRangeMin,
    scalarRangeMax,
    showAxes,
    showBounds,
    clipEnabled,
    clipAxis,
    clipPosition,
    progress,
  ]);

  return (
    <main className="app-shell" style={{ gridTemplateRows: "auto 1fr" }}>
      <header className="top-row">
        <div>
          <p className="badge" style={{ margin: 0 }}>
            Step 2 of 2
          </p>
          <h1 style={{ margin: "0.45rem 0 0", fontSize: "1.7rem" }}>3D Simulation Viewer</h1>
        </div>
        <div style={{ display: "flex", gap: "0.8rem" }}>
          <span className="badge mono">id: {id}</span>
          <Link href="/upload" style={{ color: "var(--text-1)" }}>
            New Upload
          </Link>
        </div>
      </header>

      <section
        className="viewer-layout"
      >
        <ControlsPanel
          scalars={meta?.scalars ?? []}
          activeScalar={activeScalar}
          onScalarChange={setActiveScalar}
          colormap={colormap}
          onColormapChange={setColormap}
          scalarRangeMin={scalarRangeMin}
          scalarRangeMax={scalarRangeMax}
          onRangeMinChange={setScalarRangeMin}
          onRangeMaxChange={setScalarRangeMax}
          onResetRange={resetRange}
          showAxes={showAxes}
          onToggleAxes={setShowAxes}
          showBounds={showBounds}
          onToggleBounds={setShowBounds}
          clipEnabled={clipEnabled}
          onToggleClipEnabled={setClipEnabled}
          clipAxis={clipAxis}
          onClipAxisChange={setClipAxis}
          clipPosition={clipPosition}
          onClipPositionChange={setClipPosition}
          clipBounds={clipBounds}
          stats={meta?.stats ?? null}
        />
        {viewerContent}
      </section>
    </main>
  );
}
