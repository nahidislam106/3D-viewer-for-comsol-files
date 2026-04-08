"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import FileUploader from "@/components/FileUploader";

type FileListItem = {
  id: string;
  filename: string;
  source_extension?: string;
  status: "ready" | "pending_conversion" | "processing";
  created_at?: string;
  updated_at?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function UploadPage() {
  const [items, setItems] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      const response = await fetch(`${API_BASE}/files?limit=80`);
      const payload = (await response.json()) as { items?: FileListItem[]; detail?: string };
      if (!response.ok) {
        throw new Error(payload.detail ?? "Failed to load upload history");
      }
      setItems(payload.items ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load upload history";
      setHistoryError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const stats = useMemo(() => {
    const total = items.length;
    const ready = items.filter((item) => item.status === "ready").length;
    const pending = total - ready;
    return { total, ready, pending };
  }, [items]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/file/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { success?: boolean; detail?: string };
      if (!response.ok) {
        throw new Error(payload.detail ?? "Delete failed");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      setToast("Deleted");
      window.setTimeout(() => setToast(null), 1800);
    } catch (deleteError) {
      setHistoryError(deleteError instanceof Error ? deleteError.message : "Delete failed");
    }
  }, []);

  return (
    <main className="app-shell" style={{ gridTemplateRows: "auto 1fr" }}>
      <header className="top-row">
        <div>
          <p className="badge" style={{ margin: 0 }}>
            Step 1 of 2
          </p>
          <h1 style={{ margin: "0.45rem 0 0", fontSize: "1.8rem" }}>Upload Simulation File</h1>
        </div>
        <Link href="/" className="subtle">
          Home
        </Link>
      </header>

      <section className="two-col-layout">
        <div style={{ width: "100%" }}>
          <FileUploader onUploaded={() => void fetchHistory()} />
        </div>

        <aside className="panel stack" style={{ padding: "1rem", maxHeight: "72vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Recent Uploads</h2>
            <button type="button" className="button" style={{ padding: "0.4rem 0.7rem" }} onClick={() => void fetchHistory()}>
              Refresh
            </button>
          </div>

          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.88rem" }}>
            Total {stats.total} | Ready {stats.ready} | Pending {stats.pending}
          </p>

          {toast ? <p style={{ margin: 0, color: "var(--accent)", fontSize: "0.86rem" }}>{toast}</p> : null}

          {loading ? <p style={{ margin: 0, color: "var(--text-1)" }}>Loading history...</p> : null}
          {historyError ? <p style={{ margin: 0, color: "var(--danger)" }}>{historyError}</p> : null}

          {!loading && !historyError && items.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.92rem" }}>No uploads yet. Upload your first dataset.</p>
          ) : null}

          <div className="history-list">
            {items.map((item) => {
              const ts = item.updated_at ?? item.created_at;
              const dateText = ts ? new Date(ts).toLocaleString() : "Unknown time";
              const isReady = item.status === "ready";
              const label = item.status === "ready" ? "ready" : item.status === "processing" ? "processing" : "pending";
              return (
                <div key={item.id} className={`panel history-item ${isReady ? "ready" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                    <Link href={`/viewer/${item.id}`} style={{ fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {item.filename}
                    </Link>
                    <span className="badge" style={{ color: isReady ? "var(--accent-2)" : "var(--accent-3)" }}>
                      {label}
                    </span>
                  </div>
                  <span className="mono" style={{ color: "var(--text-1)", fontSize: "0.78rem" }}>
                    {item.id}
                  </span>
                  <span style={{ color: "var(--text-1)", fontSize: "0.8rem" }}>{dateText}</span>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem" }}>
                    <button
                      type="button"
                      className="button ghost"
                      style={{ padding: "0.42rem 0.66rem" }}
                      onClick={() => window.open(`${API_BASE}/file/${item.id}/download`, "_blank", "noopener,noreferrer")}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="button ghost"
                      style={{ padding: "0.42rem 0.66rem", color: "var(--danger)", borderColor: "rgba(214,59,83,0.25)" }}
                      onClick={() => void handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
