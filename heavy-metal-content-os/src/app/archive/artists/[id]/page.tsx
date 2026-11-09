import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { clearedWorksByPerson, rightsFor, lastUsed } from "@/lib/rules";
import { PageHeader, Conf, Rights, Section, Thumb, Stat } from "@/components/ui";

export default async function Artist({ params }: PageProps<"/archive/artists/[id]">) {
  const id = Number((await params).id);
  const p = get<{ id: number; name: string; bio: string | null }>("SELECT * FROM people WHERE id=?", id);
  if (!p) notFound();
  const works = all<{ cid: number; role: string; confidence: string; item_id: number; title: string; kind: string; page_start: number; issue_id: number; volume: string; issue_number: string; cover_date: string; publication_date: string; thumb: string | null }>(`
    SELECT c.id cid, c.role, c.confidence, i.id item_id, i.title, i.kind, i.page_start, s.id issue_id, s.volume, s.issue_number, s.cover_date, s.publication_date, pg.thumbnail_path thumb
    FROM credits c JOIN issue_items i ON c.target_type='issue_item' AND i.id=c.target_id JOIN issues s ON s.id=i.issue_id
    LEFT JOIN pages pg ON pg.issue_id=s.id AND pg.page_number=i.page_start WHERE c.person_id=? ORDER BY s.publication_date, i.page_start`, id);
  const cw = clearedWorksByPerson(id);
  const year = new Date().getFullYear();
  const usedThisYear = get<{ n: number }>("SELECT COUNT(DISTINCT content_item_id) n FROM run_log WHERE entity_type='person' AND entity_id=? AND published_at>=?", id, `${year}-01-01`)!.n;
  const lu = lastUsed("person", id);
  return (
    <div>
      <PageHeader kicker="Creator" title={p.name}>
        <Link href={`/create/carousel?franchise=artist-spotlight&person=${id}`} className="btn btn-red">Artist Spotlight</Link>
      </PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Stat label="Credits in archive" value={works.length} />
        <Stat label="Cleared works" value={`${cw.cleared}/5`} sub={cw.cleared >= 5 ? "Artist Spotlight eligible" : "Spotlight needs 5 cleared works"} />
        <Stat label={`Published in ${year}`} value={usedThisYear} sub={usedThisYear >= 6 ? "⚠ Heavy rotation this year" : undefined} />
        <Stat label="Last used" value={lu ? lu.published_at.slice(0, 10) : "Never"} sub={lu?.platform} />
      </div>
      <Section title="Work in the archive">
        <div className="space-y-2">
          {works.map((w) => (
            <Link key={w.cid} href={`/archive/issues/${w.issue_id}?page=${w.page_start}`} className="card p-3 flex gap-4 items-center hover:border-neutral-500">
              <Thumb path={w.thumb} alt="" className="w-12 h-16" />
              <div className="flex-1">
                <b>{w.title}</b> <span className="text-neutral-500 text-sm">{w.role} · {w.kind}</span>
                <div className="text-xs text-neutral-500">{issueLabel(w)} · p.{w.page_start}</div>
              </div>
              <Conf c={w.confidence} /> <Rights s={rightsFor("issue_item", w.item_id).status} />
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
