"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Phase =
  | { name: "idle" }
  | { name: "hashing" }
  | { name: "signing" }
  | { name: "uploading" }
  | { name: "done"; assetId: string }
  | { name: "error"; message: string };

async function sha256Hex(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Client leaf of the upload flow: hash locally → sign (server mints the
// presigned URL, keys never leave it) → PUT straight to storage → refresh.
// The scan worker picks the file up asynchronously; the asset row starts PENDING.
export function UploadForm({ depositId }: { depositId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const typeSelect = form.elements.namedItem("assetType") as HTMLSelectElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      setPhase({ name: "hashing" });
      const sha256 = await sha256Hex(file);
      setPhase({ name: "signing" });
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          depositId,
          filename: file.name,
          assetType: typeSelect.value,
          sizeBytes: file.size,
          sha256,
        }),
      });
      if (!signRes.ok) {
        const problem = (await signRes.json()) as {
          error?: { message?: string };
        };
        throw new Error(problem.error?.message ?? `Sign failed (${signRes.status}).`);
      }
      const signed = (await signRes.json()) as { url: string; assetId: string };
      setPhase({ name: "uploading" });
      const putRes = await fetch(signed.url, {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status}).`);
      }
      setPhase({ name: "done", assetId: signed.assetId });
      input.value = "";
      router.refresh();
    } catch (error) {
      setPhase({
        name: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const busy =
    phase.name === "hashing" ||
    phase.name === "signing" ||
    phase.name === "uploading";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
      <label className="field">
        <span>Asset type</span>
        <select name="assetType" disabled={busy} defaultValue="SOURCE">
          <option value="SOURCE">Source code</option>
          <option value="DATABASE">Database / schema</option>
          <option value="CONFIG">Configuration</option>
          <option value="DOCS">Documentation</option>
          <option value="BUILD_SCRIPT">Build script</option>
          <option value="API_SPEC">API specification</option>
        </select>
      </label>
      <label className="field">
        <span>File</span>
        <input type="file" name="file" required disabled={busy} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? `${phase.name}…` : "Upload"}
        </button>
        {phase.name === "done" && (
          <span className="text-emerald-700">
            Stored — integrity scan will pick it up shortly.
          </span>
        )}
        {phase.name === "error" && (
          <span className="text-rose-700">{phase.message}</span>
        )}
      </div>
    </form>
  );
}
