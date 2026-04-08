"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UploadResponse = {
  id: string;
  status: "ready" | "pending_conversion" | "processing";
  message?: string;
};

type ChunkResponse =
  | UploadResponse
  | {
      status: "chunk_received";
      id: string;
      chunk_index: number;
      total_chunks: number;
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
  const [progressPercent, setProgressPercent] = useState(0);
  const [chunkLabel, setChunkLabel] = useState("");

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
    setProgressPercent(0);
    setChunkLabel("");

    try {
      const chunkSize = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const fileId = crypto.randomUUID();
      let finalPayload: UploadResponse | null = null;

      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        setChunkLabel(`Uploading chunk ${index + 1} of ${totalChunks}...`);

        let success = false;
        let lastError = "Chunk upload failed";

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const body = new FormData();
            body.append("file", chunk, file.name);

            const response = await fetch(`${API_BASE}/upload`, {
              method: "POST",
              body,
              headers: {
                "X-Chunk-Index": String(index),
                "X-Total-Chunks": String(totalChunks),
                "X-File-Id": fileId,
              },
            });

            const payload = (await response.json()) as ChunkResponse | { detail: string };
            if (!response.ok) {
              throw new Error("detail" in payload ? payload.detail : "Chunk upload failed");
            }

            success = true;
            if ((payload as ChunkResponse).status !== "chunk_received") {
              finalPayload = payload as UploadResponse;
            }
            break;
          } catch (chunkError) {
            lastError = chunkError instanceof Error ? chunkError.message : "Chunk upload failed";
          }
        }

        if (!success) {
          throw new Error(lastError);
        }

        setProgressPercent(Math.round(((index + 1) / totalChunks) * 100));
      }

      if (!finalPayload) {
        throw new Error("Upload did not return final payload");
      }

      const data = finalPayload;
      onUploaded?.(data);
      if (data.status === "ready" || data.status === "pending_conversion" || data.status === "processing") {
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
    <div className="panel stack" style={{ padding: "1rem" }}>
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
        className={`dropzone ${dragActive ? "active" : ""}`}
      >
        <div>
          <p style={{ margin: 0, marginBottom: "0.3rem", fontWeight: 700, fontSize: "1.05rem" }}>Drag and drop a simulation file</p>
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

      {busy ? (
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <div style={{ width: "100%", height: 10, borderRadius: 999, background: "rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "linear-gradient(120deg, var(--accent), var(--accent-2))",
                transition: "width 120ms ease",
              }}
            />
          </div>
          <span className="mono" style={{ color: "var(--text-1)", fontSize: "0.82rem" }}>
            {chunkLabel} {progressPercent}%
          </span>
        </div>
      ) : null}

      {error ? <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      {note ? <p style={{ color: "var(--text-1)", margin: 0 }}>{note}</p> : null}
    </div>
  );
}
