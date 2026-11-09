import Link from "next/link";
import { all } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { rightsFor, lastUsed } from "@/lib/rules";
import { PageHeader, Conf, Rights, Thumb, Empty } from "@/components/ui";

export default async function Artwork({ searchParams }: PageProps<"/archive/artwork">) {
  const sp = await searchParams;
  const kind = String(sp.kind ?? "");
  const rows = all<{ id: number; title: string | null; kind: string; notability_note: string | null; confidence: string; issue_id: number; page_number: number | null; thumb: string | null; volume: string; issue_number: string; cover_date: string }>(`
    SELECT a.id, a.title, a.kind, a.notability_note, a.confidence, a.issue_id, p.page_number, p.thumbnail_path thumb, s.volume, s.issue_number, s.cover_date
    FROM artworks a LEFT JOIN pages p ON p.id=a.page_id LEFT JOIN issues s ON s.id=a.issue_id WHERE (?='' OR a.kind=?) ORDER BY s.publication_date LIMIT 300`, kind, kind);
  return (
    <div>
      <PageHeader kicker="Archive" title="Artwork" sub="Covers, panels, spreads, pin-ups, roughs and rejected versions." />
      <div className="flex gap-2 mb-6 flex-wrap">{["", "cover", "panel", "spread", "pinup", "rough", "rejected"].map((k) => <Link key={k} href={`/archive/artwork${k ? `?kind=${k}` : ""}`} className={`chip ${kind === k ? "border-hm text-hm" : ""}`}>{k || "all"}</Link>)}</div>
      {rows.length ? <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-5">
        {rows.map((a) => { const lu = lastUsed("artwork", a.id); return (
          <Link key={a.id} href={`/archive/issues/${a.issue_id}?page=${a.page_number}`}>
            <Thumb path={a.thumb} alt="" className="w-full aspect-[3/4]" />
            <div className="text-xs mt-1 font-semibold">{a.title ?? a.kind}</div>
            <div className="text-[11px] text-neutral-500">{issueLabel(a)} p.{a.page_number}</div>
            <div className="flex gap-1 mt-1"><Conf c={a.confidence} /><Rights s={rightsFor("artwork", a.id).status} /></div>
            <div className="text-[11px] text-neutral-500 mt-1">{lu ? `Used ${lu.published_at.slice(0, 10)}` : "Never used"}</div>
          </Link>); })}
      </div> : <Empty title="No artwork records yet" />}
    </div>
  );
}
