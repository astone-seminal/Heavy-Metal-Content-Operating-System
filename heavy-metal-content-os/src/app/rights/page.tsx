import Link from "next/link";
import { all, get, j } from "@/lib/db";
import { contentRights, daysUntil, type ContentItem } from "@/lib/rules";
import { RIGHTS_STATUSES } from "@/lib/constants";
import { PageHeader, Section, Rights, Stat, Empty } from "@/components/ui";
import { setRights } from "@/app/actions";

const LABEL_SQL: Record<string, string> = {
  issue: "SELECT COALESCE('Heavy Metal Vol. '||volume||' #'||issue_number, title, 'Issue '||id) l FROM issues WHERE id=?",
  issue_item: "SELECT i.title||' — Vol. '||COALESCE(s.volume,'?')||' #'||COALESCE(s.issue_number,'?')||' p.'||COALESCE(i.page_start,'?') l FROM issue_items i JOIN issues s ON s.id=i.issue_id WHERE i.id=?",
  artwork: "SELECT COALESCE(a.title, a.kind)||' p.'||COALESCE(p.page_number,'?') l FROM artworks a LEFT JOIN pages p ON p.id=a.page_id WHERE a.id=?",
  asset: "SELECT COALESCE(title, storage_path) l FROM assets WHERE id=?", page: "SELECT 'Page '||page_number l FROM pages WHERE id=?",
};
const label = (t: string, id: number) => (LABEL_SQL[t] && get<{ l: string }>(LABEL_SQL[t], id)?.l) || `${t} ${id}`;

export default async function RightsPage({ searchParams }: PageProps<"/rights">) {
  const sp = await searchParams;
  const status = String(sp.status ?? "");
  const records = all<{ id: number; target_type: string; target_id: number; rights_owner: string | null; status: string; usage_types: string; platform_permissions: string; restrictions: string | null; expires_at: string | null; source: string | null; requested_at: string | null; approver: string | null; approved_at: string | null }>(
    "SELECT * FROM rights_records WHERE (?='' OR status=?) ORDER BY CASE status WHEN 'requested' THEN 0 WHEN 'pending' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END, requested_at", status, status);
  const counts = Object.fromEntries(all<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM rights_records GROUP BY status").map((r) => [r.status, r.n]));
  const blocking = all<ContentItem>("SELECT * FROM content_items WHERE stage NOT IN ('published','rejected','evergreen') AND publish_at IS NOT NULL ORDER BY publish_at")
    .map((c) => ({ c, r: contentRights(c.id), d: daysUntil(c.publish_at) })).filter((x) => x.r.rows.some((row) => row.status !== "cleared"));
  const expiring = all<{ target_type: string; target_id: number; expires_at: string }>("SELECT target_type, target_id, expires_at FROM rights_records WHERE status='cleared' AND expires_at IS NOT NULL AND expires_at <= date('now','+60 days') ORDER BY expires_at");
  const editing = sp.type && sp.id ? { type: String(sp.type), id: Number(sp.id), rec: get<Record<string, string | null>>("SELECT * FROM rights_records WHERE target_type=? AND target_id=?", String(sp.type), Number(sp.id)) } : null;

  return (
    <div>
      <PageHeader kicker="Rights & clearance" title="Nothing uncleared goes out." sub="Archive assets go to Colburn in one batch four weeks out. Uncleared is cut. Paid needs its own clearance." />
      {sp.batched && <p className="mb-6 text-green-400 text-sm">{String(sp.batched)} asset(s) marked Requested.</p>}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10">{RIGHTS_STATUSES.map((s) => <Stat key={s} label={s} value={counts[s] ?? 0} href={`/rights?status=${s}`} />)}</div>

      {editing && <Section title={`Set rights: ${label(editing.type, editing.id)}`}><RightsForm type={editing.type} id={editing.id} rec={editing.rec} /></Section>}

      <Section title="Blocking scheduled content">
        {blocking.length ? <table className="table"><thead><tr><th>Publishes</th><th>Content</th><th>Uncleared assets</th></tr></thead><tbody>
          {blocking.map(({ c, r, d }) => <tr key={c.id}><td className={d != null && d <= 28 ? "text-hm font-bold" : ""}>{c.publish_at} ({d}d){d != null && d <= 28 ? " ⚠ past W−4" : ""}</td><td><Link className="link" href={`/content/${c.id}`}>{c.title}</Link></td>
            <td>{r.rows.filter((x) => x.status !== "cleared").map((x) => <div key={`${x.entity_type}${x.entity_id}`} className="flex gap-2 items-center mb-1"><Rights s={x.status} /> <Link className="link text-xs" href={`/rights?type=${x.entity_type}&id=${x.entity_id}`}>{label(x.entity_type, x.entity_id)}</Link></div>)}</td></tr>)}
        </tbody></table> : <p className="text-sm text-neutral-500">No scheduled content is waiting on rights.</p>}
      </Section>

      {expiring.length > 0 && <Section title="Expiring within 60 days"><ul className="text-sm">{expiring.map((e) => <li key={`${e.target_type}${e.target_id}`}>{e.expires_at} · <Link className="link" href={`/rights?type=${e.target_type}&id=${e.target_id}`}>{label(e.target_type, e.target_id)}</Link></li>)}</ul></Section>}

      <Section title={status ? `Records: ${status}` : "All records"} action={status ? <Link href="/rights" className="btn">Clear filter</Link> : undefined}>
        {records.length ? <table className="table"><thead><tr><th>Asset</th><th>Status</th><th>Owner</th><th>Usage</th><th>Platforms</th><th>Expires</th><th>Restrictions</th><th>Approved</th><th></th></tr></thead><tbody>
          {records.map((r) => <tr key={r.id}><td>{label(r.target_type, r.target_id)}<div className="text-[10px] text-neutral-600">{r.target_type}</div></td><td><Rights s={r.status} /></td><td>{r.rights_owner ?? "—"}</td><td className="text-xs">{j<string[]>(r.usage_types, []).join(", ")}</td>
            <td className="text-xs">{j<string[]>(r.platform_permissions, []).join(", ") || "all"}</td><td>{r.expires_at ?? "—"}</td><td className="text-xs">{r.restrictions}</td><td className="text-xs">{r.approver ? `${r.approver} ${r.approved_at?.slice(0, 10) ?? ""}` : "—"}</td>
            <td><Link className="link text-xs" href={`/rights?type=${r.target_type}&id=${r.target_id}`}>edit</Link></td></tr>)}
        </tbody></table> : <Empty title="No rights records">Records are created when you set rights on an issue, story or artwork, or send a month&apos;s batch from the calendar.</Empty>}
      </Section>
    </div>
  );
}

function RightsForm({ type, id, rec }: { type: string; id: number; rec?: Record<string, string | null> }) {
  const usage = j<string[]>(rec?.usage_types, ["organic"]);
  const plats = j<string[]>(rec?.platform_permissions, []);
  return (
    <form action={setRights} className="card p-5 grid md:grid-cols-3 gap-4">
      <input type="hidden" name="target_type" value={type} /><input type="hidden" name="target_id" value={id} /><input type="hidden" name="back" value={`/rights?type=${type}&id=${id}`} />
      <div><label className="label">Status</label><select name="status" defaultValue={rec?.status ?? "unknown"} className="select">{RIGHTS_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div><label className="label">Rights owner</label><input name="rights_owner" defaultValue={rec?.rights_owner ?? ""} className="input" /></div>
      <div><label className="label">Approver</label><input name="approver" defaultValue={rec?.approver ?? ""} className="input" placeholder="Colburn" /></div>
      <div><label className="label">Usage</label><div className="flex gap-3 text-sm">{["organic", "paid", "web", "commerce"].map((u) => <label key={u} className="flex gap-1 items-center"><input type="checkbox" name="usage_types" value={u} defaultChecked={usage.includes(u)} />{u}</label>)}</div></div>
      <div><label className="label">Platforms (none = all)</label><div className="flex gap-2 flex-wrap text-xs">{["instagram", "tiktok", "youtube", "facebook", "website", "email", "x", "linkedin"].map((p) => <label key={p} className="flex gap-1 items-center"><input type="checkbox" name="platform_permissions" value={p} defaultChecked={plats.includes(p)} />{p}</label>)}</div></div>
      <div><label className="label">Expires</label><input type="date" name="expires_at" defaultValue={rec?.expires_at ?? ""} className="input" /></div>
      <div className="md:col-span-2"><label className="label">Restrictions</label><input name="restrictions" defaultValue={rec?.restrictions ?? ""} className="input" /></div>
      <div><label className="label">Source / reference</label><input name="source" defaultValue={rec?.source ?? ""} className="input" /></div>
      <div><button className="btn btn-red">Save</button></div>
    </form>
  );
}
