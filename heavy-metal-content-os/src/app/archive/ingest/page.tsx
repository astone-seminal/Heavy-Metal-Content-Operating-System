import Link from "next/link";
import { all } from "@/lib/db";
import { aiAvailable } from "@/lib/ai/claude";
import { PageHeader, Section, NotConnected } from "@/components/ui";
import { Uploader } from "./uploader";

export default function Ingest() {
  const jobs = all<{ id: number; issue_id: number; status: string; step: string; started_at: string; title: string }>(
    "SELECT j.id, j.issue_id, j.status, j.step, j.started_at, a.title FROM ingestion_jobs j LEFT JOIN assets a ON a.id=j.asset_id ORDER BY j.id DESC LIMIT 50");
  return (
    <div>
      <PageHeader kicker="Archive" title="Ingest issues" sub="Upload magazine PDFs. Each one is identified, split into pages, made searchable and thumbnailed. Contents, credits and page ranges are extracted for review. Nothing is marked Verified until a person checks it against the printed page." />
      {!aiAvailable() && <div className="mb-6"><NotConnected what="AI extraction is off.">Pages, text and thumbnails will still be processed. Contents, credits and artwork are extracted only when Heavy Metal AI is connected; until then add them by hand on the issue page.</NotConnected></div>}
      <Uploader />
      <Section title="Pipeline">
        <ol className="grid md:grid-cols-5 gap-2 text-xs text-neutral-400">
          {["Identify issue (filename + indicia)", "Extract text per page", "Render thumbnails", "AI: contents, page ranges, credits, characters, notable art", "Confidence check + review queue"].map((s, i) => (
            <li key={s} className="card p-3"><div className="display text-2xl text-hm">{i + 1}</div>{s}</li>))}
        </ol>
        <p className="text-xs text-neutral-500 mt-3">Confidence: credits are <b>Likely</b> only if the name is actually printed on the page the AI cites; otherwise <b>Needs Review</b>. Only a person can mark <b>Verified</b>.</p>
      </Section>
      <Section title="Recent jobs">
        <table className="table">
          <thead><tr><th>File</th><th>Status</th><th>Step</th><th>Started</th><th></th></tr></thead>
          <tbody>{jobs.map((j) => (
            <tr key={j.id}><td>{j.title}</td><td className={j.status === "failed" ? "text-hm" : j.status === "done" ? "text-green-500" : "text-amber-400"}>{j.status}</td><td>{j.step}</td><td className="text-neutral-500">{j.started_at}</td>
              <td>{j.issue_id && <Link className="link" href={`/archive/issues/${j.issue_id}`}>Open issue</Link>}</td></tr>))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
