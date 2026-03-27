"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UploadResponse = {
  id: string;
  status: "ready" | "pending_conversion";
  message?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type FileUploaderProps = {
  onUploaded?: (payload: UploadResponse) => void;
};

export default function FileUploader({ onUploaded }: FileUploaderProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const helperText = useMemo(() => {
    if (!file) {
      return "Supports .mph, .vtk, .vtu, .vtp";
    }
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `${file.name} (${sizeMB} MB)`;
  }, [file]);

  async function submitUpload() {
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setNote(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as UploadResponse | { detail: string };
      if (!response.ok) {
        throw new Error("detail" in payload ? payload.detail : "Upload failed");
      }

      const data = payload as UploadResponse;
      onUploaded?.(data);
      if (data.status === "ready" || data.status === "pending_conversion") {
        router.push(`/viewer/${data.id}`);
        return;
      }

      setNote(data.message ?? "Upload accepted; conversion is still pending.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const dropped = event.dataTransfer.files?.[0] ?? null;
          if (dropped) {
            setFile(dropped);
          }
        }}
        style={{
          border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--panel-border)"}`,
          borderRadius: 14,
          padding: "1.3rem",
          transition: "border-color 150ms ease, background-color 150ms ease",
          background: dragActive ? "rgba(49,211,167,0.08)" : "rgba(8,10,14,0.4)",
          minHeight: 170,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ margin: 0, marginBottom: "0.3rem", fontWeight: 600 }}>Drag and drop a simulation file</p>
          <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.9rem" }}>{helperText}</p>
          <label className="button" style={{ display: "inline-block", marginTop: "0.9rem" }}>
            Choose File
            <input
              hidden
              type="file"
              accept=".mph,.vtk,.vtu,.vtp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <button type="button" className="button" disabled={!file || busy} onClick={submitUpload}>
        {busy ? "Uploading..." : "Upload and Process"}
      </button>

      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      {note ? <p style={{ color: "var(--text-1)", margin: 0 }}>{note}</p> : null}
    </div>
  );
}
