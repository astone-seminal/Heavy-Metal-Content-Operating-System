import Link from "next/link";
import { all } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { PageHeader, Conf, Empty } from "@/components/ui";

export default async function Stories({ searchParams }: PageProps<"/archive/stories">) {
  const q = String((await searchParams).q ?? "");
  const rows = all<{ id: number; title: string; page_start: number; confidence: string; issue_id: number; volume: string; issue_number: string; cover_date: string; creators: string | null; used: string | null }>(`
    SELECT i.id, i.title, i.page_start, i.confidence, s.id issue_id, s.volume, s.issue_number, s.cover_date,
      (SELECT GROUP_CONCAT(p.name || ' (' || c.role || ')', ', ') FROM credits c JOIN people p ON p.id=c.person_id WHERE c.target_type='issue_item' AND c.target_id=i.id) creators,
      (SELECT MAX(published_at) FROM run_log l WHERE l.entity_type='issue_item' AND l.entity_id=i.id) used
    FROM issue_items i JOIN issues s ON s.id=i.issue_id WHERE i.kind='story' AND i.title LIKE ? ORDER BY s.publication_date, i.page_start LIMIT 500`, `%${q}%`);
  return (
    <div>
      <PageHeader kicker="Archive" title="Stories" sub="Each appearance of a story in an issue. Serialised stories appear once per issue." />
      <form className="mb-6 max-w-md"><input name="q" defaultValue={q} className="input" placeholder="Filter by title" /></form>
      {rows.length ? <table className="table"><thead><tr><th>Title</th><th>Creators</th><th>Issue</th><th>Page</th><th>Status</th><th>Last published</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td><Link className="link font-semibold" href={`/archive/issues/${r.issue_id}?page=${r.page_start}`}>{r.title}</Link></td><td className="text-xs">{r.creators ?? "—"}</td><td className="text-xs">{issueLabel(r)}</td><td>{r.page_start}</td><td><Conf c={r.confidence} /></td><td className="text-neutral-500">{r.used?.slice(0, 10) ?? "Never"}</td></tr>)}
      </tbody></table> : <Empty title="No stories yet" />}
    </div>
  );
}
