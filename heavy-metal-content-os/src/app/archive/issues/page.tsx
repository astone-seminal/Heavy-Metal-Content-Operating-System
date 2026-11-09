import Link from "next/link";
import { all } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { PageHeader, Conf, Thumb, Empty } from "@/components/ui";

export default function Issues() {
  const rows = all<{ id: number; volume: string; issue_number: string; cover_date: string; title: string; publication_date: string; confidence: string; page_count: number; cover: string | null; items: number; unreviewed: number }>(`
    SELECT s.*, a.storage_path cover, (SELECT COUNT(*) FROM issue_items i WHERE i.issue_id=s.id) items,
      (SELECT COUNT(*) FROM issue_items i WHERE i.issue_id=s.id AND i.confidence!='verified') unreviewed
    FROM issues s LEFT JOIN assets a ON a.id=s.cover_asset_id ORDER BY s.publication_date, CAST(s.volume AS INT), CAST(s.issue_number AS INT), s.id`);
  return (
    <div>
      <PageHeader kicker="Archive" title="Issues" sub={`${rows.length} issues in the archive.`}><Link href="/archive/ingest" className="btn btn-red">Upload</Link></PageHeader>
      {rows.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {rows.map((r) => (
            <Link key={r.id} href={`/archive/issues/${r.id}`} className="group">
              <Thumb path={r.cover} alt="" className="w-full aspect-[3/4] group-hover:opacity-80" />
              <div className="mt-2 text-sm font-semibold">{issueLabel(r)}</div>
              <div className="text-xs text-neutral-500 flex gap-2 items-center mt-1"><Conf c={r.confidence} /> {r.items} items{r.unreviewed ? `, ${r.unreviewed} to review` : ""}</div>
            </Link>
          ))}
        </div>
      ) : <Empty title="No issues yet">Upload PDFs to start the archive.</Empty>}
    </div>
  );
}
