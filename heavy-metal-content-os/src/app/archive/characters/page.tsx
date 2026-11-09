import Link from "next/link";
import { all } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { PageHeader, Conf, Empty } from "@/components/ui";

export default async function Characters({ searchParams }: PageProps<"/archive/characters">) {
  const q = String((await searchParams).q ?? "");
  const rows = all<{ id: number; name: string; title: string; page_start: number; issue_id: number; volume: string; issue_number: string; cover_date: string; confidence: string }>(`
    SELECT ch.id, ch.name, i.title, i.page_start, s.id issue_id, s.volume, s.issue_number, s.cover_date, a.confidence
    FROM characters ch JOIN character_appearances a ON a.character_id=ch.id JOIN issue_items i ON i.id=a.issue_item_id JOIN issues s ON s.id=i.issue_id
    WHERE ch.name LIKE ? ORDER BY ch.name, s.publication_date`, `%${q}%`);
  const byName = new Map<string, typeof rows>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  return (
    <div>
      <PageHeader kicker="Archive" title="Characters" sub="Every appearance, linked to issue and page." />
      <form className="mb-6 max-w-md"><input name="q" defaultValue={q} className="input" placeholder="Show every appearance of…" /></form>
      {byName.size ? [...byName].map(([name, apps]) => (
        <div key={name} className="mb-6"><h3 className="display text-2xl">{name} <span className="text-neutral-500 text-base">{apps.length} appearances</span></h3>
          <ul className="text-sm mt-2 space-y-1">{apps.map((a, k) => <li key={k}><Link className="link" href={`/archive/issues/${a.issue_id}?page=${a.page_start}`}>{a.title}</Link> <span className="text-neutral-500">· {issueLabel(a)} p.{a.page_start}</span> <Conf c={a.confidence} /></li>)}</ul></div>
      )) : <Empty title="No characters yet" />}
    </div>
  );
}
