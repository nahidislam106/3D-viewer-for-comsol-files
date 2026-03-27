"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import FileUploader from "@/components/FileUploader";

type FileListItem = {
  id: string;
  filename: string;
  source_extension?: string;
  status: "ready" | "pending_conversion";
  created_at?: string;
  updated_at?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function UploadPage() {
  const [items, setItems] = useState<FileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

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

  return (
    <main className="app-shell" style={{ gridTemplateRows: "auto 1fr" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="badge" style={{ margin: 0 }}>
            Step 1 of 2
          </p>
          <h1 style={{ margin: "0.45rem 0 0", fontSize: "1.8rem" }}>Upload Simulation File</h1>
        </div>
        <Link href="/" style={{ color: "var(--text-1)" }}>
          Home
        </Link>
      </header>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
          alignItems: "start",
        }}
      >
        <div style={{ width: "100%" }}>
          <FileUploader onUploaded={() => void fetchHistory()} />
        </div>

        <aside className="panel" style={{ padding: "1rem", display: "grid", gap: "0.9rem", maxHeight: "72vh", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Recent Uploads</h2>
            <button type="button" className="button" style={{ padding: "0.4rem 0.7rem" }} onClick={() => void fetchHistory()}>
              Refresh
            </button>
          </div>

          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.88rem" }}>
            Total {stats.total} | Ready {stats.ready} | Pending {stats.pending}
          </p>

          {loading ? <p style={{ margin: 0, color: "var(--text-1)" }}>Loading history...</p> : null}
          {historyError ? <p style={{ margin: 0, color: "var(--danger)" }}>{historyError}</p> : null}

          {!loading && !historyError && items.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.92rem" }}>No uploads yet. Upload your first dataset.</p>
          ) : null}

          <div style={{ display: "grid", gap: "0.65rem" }}>
            {items.map((item) => {
              const ts = item.updated_at ?? item.created_at;
              const dateText = ts ? new Date(ts).toLocaleString() : "Unknown time";
              const isReady = item.status === "ready";
              return (
                <Link
                  key={item.id}
                  href={`/viewer/${item.id}`}
                  className="panel"
                  style={{
                    padding: "0.75rem",
                    display: "grid",
                    gap: "0.35rem",
                    borderColor: isReady ? "rgba(49, 211, 167, 0.4)" : "var(--panel-border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.filename}</strong>
                    <span className="badge" style={{ color: isReady ? "var(--accent)" : "#ffcf8d" }}>
                      {isReady ? "ready" : "pending"}
                    </span>
                  </div>
                  <span className="mono" style={{ color: "var(--text-1)", fontSize: "0.78rem" }}>
                    {item.id}
                  </span>
                  <span style={{ color: "var(--text-1)", fontSize: "0.8rem" }}>{dateText}</span>
                </Link>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
