"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import ControlsPanel from "@/components/ControlsPanel";
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
  status: "ready" | "pending_conversion";
  message?: string;
  dataset_url: string | null;
  stats?: {
    points: number;
    cells: number;
    bounds: number[];
  };
  scalars: ScalarMeta[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function ViewerPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScalar, setActiveScalar] = useState("");
  const [showAxes, setShowAxes] = useState(true);
  const [showBounds, setShowBounds] = useState(true);

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
    if (!id || !meta || meta.status === "ready") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/file/${id}`);
        const payload = (await response.json()) as FileMeta | { detail: string };
        if (!response.ok) {
          return;
        }
        const data = payload as FileMeta;
        setMeta(data);
        if (data.status === "ready") {
          setActiveScalar(data.scalars?.[0]?.name ?? "");
          window.clearInterval(timer);
        }
      } catch {
        // Keep quiet during background polling.
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [id, meta]);

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
        <div
          style={{
            border: "1px solid rgba(255, 183, 127, 0.3)",
            borderRadius: 12,
            padding: "1.2rem",
            background: "rgba(255, 183, 127, 0.05)",
          }}
        >
          <p style={{ margin: "0 0 0.8rem", color: "var(--text-0)", fontWeight: 600 }}>
            {meta.source_extension === ".mph" ? "📦 COMSOL Format Detected" : "⏳ Processing..."}
          </p>
          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.95rem", lineHeight: 1.5 }}>
            {meta.message ?? "Dataset conversion is pending."}
          </p>
          {meta.source_extension === ".mph" && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(122, 142, 173, 0.24)" }}>
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
                  <p style={{ margin: 0, color: "var(--accent-2)" }}>
                    Search for &quot;MPH to VTK converter online&quot; or use file conversion services
                  </p>
                </div>
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: 500 }}>Option 3: Try Sample Data</p>
                  <p style={{ margin: 0 }}>
                    Download a sample VTK file from{" "}
                    <a href="https://github.com/naucoin/VTKData/tree/master/Data" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>
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
        showAxes={showAxes}
        showBounds={showBounds}
      />
    );
  }, [loading, error, meta, activeScalar, showAxes, showBounds]);

  return (
    <main className="app-shell" style={{ gridTemplateRows: "auto 1fr" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "320px minmax(0, 1fr)",
          alignItems: "stretch",
        }}
      >
        <ControlsPanel
          scalars={meta?.scalars ?? []}
          activeScalar={activeScalar}
          onScalarChange={setActiveScalar}
          showAxes={showAxes}
          onToggleAxes={setShowAxes}
          showBounds={showBounds}
          onToggleBounds={setShowBounds}
          stats={meta?.stats ?? null}
        />
        {viewerContent}
      </section>
    </main>
  );
}
