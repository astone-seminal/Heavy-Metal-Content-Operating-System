import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";

export default async function Artists({ searchParams }: PageProps<"/archive/artists">) {
  const q = String((await searchParams).q ?? "");
  const rows = all<{ id: number; name: string; works: number; issues: number; verified: number; first: string | null; last: string | null; used: number }>(`
    SELECT p.id, p.name, COUNT(DISTINCT c.target_id) works, COUNT(DISTINCT i.issue_id) issues, SUM(c.confidence='verified') verified,
      MIN(s.publication_date) first, MAX(s.publication_date) last,
      (SELECT COUNT(*) FROM run_log l WHERE l.entity_type='person' AND l.entity_id=p.id) used
    FROM people p LEFT JOIN credits c ON c.person_id=p.id AND c.target_type='issue_item' LEFT JOIN issue_items i ON i.id=c.target_id LEFT JOIN issues s ON s.id=i.issue_id
    WHERE p.name LIKE ? GROUP BY p.id ORDER BY works DESC, p.name`, `%${q}%`);
  return (
    <div>
      <PageHeader kicker="Archive" title="Artists & writers" sub="Everyone credited in the archive. Credits link back to the page they're printed on." />
      <form className="mb-6 max-w-md"><input name="q" defaultValue={q} className="input" placeholder="Filter by name" /></form>
      {rows.length ? (
        <table className="table"><thead><tr><th>Name</th><th>Credits</th><th>Issues</th><th>Verified</th><th>Span</th><th>Times published</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id}><td><Link className="link font-semibold" href={`/archive/artists/${r.id}`}>{r.name}</Link></td><td>{r.works}</td><td>{r.issues}</td><td>{r.verified ?? 0}</td><td className="text-neutral-500">{r.first?.slice(0, 4) ?? "?"}–{r.last?.slice(0, 4) ?? "?"}</td><td>{r.used}</td></tr>)}
        </tbody></table>
      ) : <Empty title="No creators yet">Creators appear as issues are ingested and credits extracted.</Empty>}
    </div>
  );
}
