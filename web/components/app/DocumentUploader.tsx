"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadSimple, FileText, CheckCircle, WarningCircle, CircleNotch } from "@phosphor-icons/react";

interface PeriodOption {
  id: string;
  start_date: string;
  end_date: string;
}

export function DocumentUploader({
  projectId,
  periods,
  onUploaded,
}: {
  projectId: string;
  periods: PeriodOption[];
  onUploaded?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0]?.id || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const uploadFile = async (file: File) => {
    setError(null);
    setSuccess(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "xlsx", "csv"].includes(ext)) {
      setError("Only PDF (.pdf), Excel (.xlsx), and CSV (.csv) files are supported.");
      return;
    }

    if (file.size > 52428800) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 50 MB maximum.`);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      if (selectedPeriod) {
        formData.append("monitoringPeriodId", selectedPeriod);
      }

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Upload failed. Please check network and try again.");
      } else {
        setSuccess(`Uploaded ${file.name} successfully. Processing job queued.`);
        startTransition(() => {
          router.refresh();
          if (onUploaded) onUploaded();
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload encountered an error.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {periods.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
          <label htmlFor="upload-period" className="muted">
            Attach to period:
          </label>
          <select
            id="upload-period"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="select"
            style={{ padding: "4px 8px", fontSize: 13, width: "auto" }}
          >
            <option value="">(No specific period)</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.start_date} to {p.end_date}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragActive ? "var(--accent)" : "var(--line-strong)"}`,
          background: dragActive ? "var(--accent-tint)" : "transparent",
          borderRadius: 14,
          padding: 32,
          textAlign: "center",
          display: "grid",
          gap: 10,
          justifyItems: "center",
          transition: "all 0.15s ease",
          cursor: uploading ? "wait" : "default",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={handleChange}
          style={{ display: "none" }}
          id="file-upload-input"
          disabled={uploading}
        />

        {uploading ? (
          <>
            <CircleNotch size={32} color="var(--accent)" className="spin" />
            <b>Hashing and uploading document...</b>
            <span className="muted" style={{ fontSize: 13 }}>
              Calculating SHA-256 and queuing parser pipeline
            </span>
          </>
        ) : (
          <>
            <UploadSimple size={32} color="var(--accent)" />
            <b>Drag and drop your monitoring documents here</b>
            <span className="muted" style={{ fontSize: 13 }}>
              PDF, Excel (.xlsx) or CSV, up to 50 MB each
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              style={{ marginTop: 6 }}
            >
              Choose file
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--danger)", display: "flex", gap: 10, alignItems: "center" }}>
          <WarningCircle size={20} color="var(--danger)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--danger)" }}>{error}</span>
        </div>
      )}

      {success && (
        <div className="card" style={{ padding: "10px 14px", borderLeft: "3px solid var(--ok)", display: "flex", gap: 10, alignItems: "center" }}>
          <CheckCircle size={20} color="var(--ok)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--ok)" }}>{success}</span>
        </div>
      )}
    </div>
  );
}
