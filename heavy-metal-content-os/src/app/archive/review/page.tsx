import Link from "next/link";
import { all, j } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { PageHeader, Conf, Section, Empty, Thumb } from "@/components/ui";
import { verifyRecord } from "@/app/actions";

export default function Review() {
  const items = all<{ id: number; title: string; kind: string; page_start: number; page_end: number; confidence: string; provenance: string; issue_id: number; volume: string; issue_number: string; cover_date: string; thumb: string | null }>(`
    SELECT i.*, s.volume, s.issue_number, s.cover_date, p.thumbnail_path thumb FROM issue_items i JOIN issues s ON s.id=i.issue_id
    LEFT JOIN pages p ON p.issue_id=i.issue_id AND p.page_number=i.page_start WHERE i.confidence!='verified' ORDER BY i.confidence DESC, s.id, i.page_start LIMIT 200`);
  const credits = all<{ id: number; name: string; role: string; confidence: string; provenance: string; title: string; issue_id: number; page_number: number | null; thumb: string | null }>(`
    SELECT c.id, p.name, c.role, c.confidence, c.provenance, i.title, i.issue_id, pg.page_number, pg.thumbnail_path thumb FROM credits c JOIN people p ON p.id=c.person_id
    JOIN issue_items i ON c.target_type='issue_item' AND i.id=c.target_id LEFT JOIN pages pg ON pg.id=c.source_page_id WHERE c.confidence!='verified' ORDER BY c.confidence DESC LIMIT 300`);
  const issues = all<{ id: number; volume: string; issue_number: string; cover_date: string; confidence: string; notes: string }>("SELECT * FROM issues WHERE confidence!='verified'");
  const back = "/archive/review";
  const V = ({ table, id }: { table: string; id: number }) => (
    <form action={verifyRecord} className="flex gap-1">
      <input type="hidden" name="table" value={table} /><input type="hidden" name="rid" value={id} /><input type="hidden" name="back" value={back} />
      <button name="confidence" value="verified" className="btn">Verified</button>
      <button name="confidence" value="needs_review" className="btn">Flag</button>
    </form>
  );
  return (
    <div>
      <PageHeader kicker="Archive" title="Review queue" sub="Check each record against the printed page, then mark it Verified. The AI never guesses silently: anything it couldn't confirm sits here." />
      {!items.length && !credits.length && !issues.length && <Empty title="Nothing to review" />}
      {issues.length > 0 && <Section title={`Issue identity (${issues.length})`}>
        <table className="table"><tbody>{issues.map((s) => <tr key={s.id}><td><Link className="link" href={`/archive/issues/${s.id}`}>{issueLabel(s)}</Link></td><td><Conf c={s.confidence} /></td><td className="text-xs text-neutral-500">{s.notes}</td><td><V table="issues" id={s.id} /></td></tr>)}</tbody></table>
      </Section>}
      {credits.length > 0 && <Section title={`Credits (${credits.length})`}>
        <table className="table"><thead><tr><th>Source page</th><th>Name</th><th>Role</th><th>Story</th><th>Check</th><th></th></tr></thead><tbody>
          {credits.map((c) => { const pv = j<{ cited_page?: number; name_found_on_page?: boolean }>(c.provenance, {}); return (
            <tr key={c.id}><td><Link href={`/archive/issues/${c.issue_id}?page=${c.page_number ?? pv.cited_page ?? ""}`}><Thumb path={c.thumb} alt="" className="w-10 h-14" /></Link></td>
              <td><b>{c.name}</b></td><td>{c.role}</td><td>{c.title}</td>
              <td><Conf c={c.confidence} /><div className="text-[11px] text-neutral-500 mt-1">{pv.name_found_on_page === false ? `Name not found in text of cited p.${pv.cited_page}` : pv.cited_page ? `Name printed on p.${pv.cited_page}` : ""}</div></td>
              <td><V table="credits" id={c.id} /></td></tr>); })}
        </tbody></table>
      </Section>}
      {items.length > 0 && <Section title={`Contents (${items.length})`}>
        <table className="table"><thead><tr><th></th><th>Issue</th><th>Pages</th><th>Title</th><th>Check</th><th></th></tr></thead><tbody>
          {items.map((i) => { const pv = j<{ uncertain?: string; title_found_on_page?: boolean }>(i.provenance, {}); return (
            <tr key={i.id}><td><Link href={`/archive/issues/${i.issue_id}?page=${i.page_start}`}><Thumb path={i.thumb} alt="" className="w-10 h-14" /></Link></td>
              <td className="text-xs">{issueLabel(i)}</td><td>{i.page_start}–{i.page_end}</td><td><b>{i.title}</b> <span className="text-neutral-500 text-xs">{i.kind}</span>
                {pv.uncertain && <div className="text-xs text-amber-300">⚠ {pv.uncertain}</div>}{pv.title_found_on_page === false && <div className="text-xs text-neutral-500">Title not found in text of p.{i.page_start}</div>}</td>
              <td><Conf c={i.confidence} /></td><td><V table="issue_items" id={i.id} /></td></tr>); })}
        </tbody></table>
      </Section>}
    </div>
  );
}
