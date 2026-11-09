"use client";
import { useState } from "react";
import Link from "next/link";

type Row = { name: string; jobId?: number | null; issueId?: number; duplicate?: boolean; error?: string; status?: string; log?: string };

export function Uploader() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: Row[] = [];
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/ingest", { method: "POST", body: fd }).then((x) => x.json()).catch((e) => ({ results: [{ name: f.name, error: String(e) }] }));
      out.push(...r.results);
      setRows([...out]);
    }
    setBusy(false);
    poll(out);
  }
  function poll(list: Row[]) {
    const t = setInterval(async () => {
      let pending = false;
      const next = await Promise.all(list.map(async (r) => {
        if (!r.jobId) return r;
        const j = await fetch(`/api/ingest/${r.jobId}`).then((x) => x.json());
        if (j.status === "running" || j.status === "queued") pending = true;
        return { ...r, status: j.status, log: j.log };
      }));
      list = next; setRows(next);
      if (!pending) clearInterval(t);
    }, 2000);
  }

  return (
    <div className="mb-10">
      <label className="block border-2 border-dashed border-neutral-700 hover:border-hm p-12 text-center cursor-pointer">
        <div className="display text-3xl text-white">{busy ? "Uploading…" : "Drop PDFs or click to choose"}</div>
        <div className="text-sm text-neutral-500 mt-2">One issue per PDF. Filenames like “HM v1 n04 1977-07.pdf” help identification.</div>
        <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      </label>
      {rows.map((r, i) => (
        <div key={i} className="card p-3 mt-2 text-sm">
          <div className="flex justify-between"><b>{r.name}</b>
            <span>{r.error ? <span className="text-hm">{r.error}</span> : r.duplicate ? "Already in archive" : r.status ?? "queued"}
              {r.issueId && <Link className="link ml-3" href={`/archive/issues/${r.issueId}`}>Open</Link>}</span></div>
          {r.log && <pre className="text-xs text-neutral-500 mt-2 whitespace-pre-wrap">{r.log}</pre>}
        </div>
      ))}
    </div>
  );
}
