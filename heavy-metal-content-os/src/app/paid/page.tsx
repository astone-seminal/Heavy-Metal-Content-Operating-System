import Link from "next/link";
import { all, get } from "@/lib/db";
import { PAID_KINDS, PAID_MONTHLY_TARGET } from "@/lib/constants";
import { contentRights } from "@/lib/rules";
import { PageHeader, Section, Stat, Rights, Empty } from "@/components/ui";
import { recommendForPaid, savePaidVariant } from "@/app/actions";

export default async function Paid({ searchParams }: PageProps<"/paid">) {
  const sp = await searchParams;
  const month = String(sp.month ?? new Date().toISOString().slice(0, 7));
  const ready = get<{ n: number }>(`SELECT COUNT(*) n FROM paid_variants v LEFT JOIN content_items c ON c.id=v.content_item_id WHERE v.status IN ('ready','live') AND (v.month=? OR substr(c.publish_at,1,7)=?)`, month, month)!.n;
  const winners = all<{ id: number; title: string; franchise: string | null; reach: number; saves: number; shares: number; eng: number; subs: number; variants: number }>(`
    SELECT c.id, c.title, f.name franchise, MAX(p.reach) reach, MAX(p.saves) saves, MAX(p.shares) shares,
      (COALESCE(MAX(p.saves),0)+COALESCE(MAX(p.shares),0)+COALESCE(MAX(p.comments),0))*1.0/NULLIF(MAX(p.reach),0) eng, SUM(p.subs_attributed) subs,
      (SELECT COUNT(*) FROM paid_variants v WHERE v.content_item_id=c.id) variants
    FROM content_items c JOIN performance_snapshots p ON p.content_item_id=c.id LEFT JOIN content_franchises f ON f.id=c.franchise_id
    WHERE c.stage='published' GROUP BY c.id ORDER BY eng DESC LIMIT 15`);
  const variants = all<{ id: number; content_item_id: number; kind: string; status: string; ad_policy_checked: number; handed_over_at: string | null; title: string; notes: string | null }>(
    "SELECT v.*, c.title FROM paid_variants v JOIN content_items c ON c.id=v.content_item_id WHERE v.status!='retired' ORDER BY CASE v.status WHEN 'planned' THEN 0 WHEN 'in_production' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END, v.id DESC");
  return (
    <div>
      <PageHeader kicker="Paid" title="Organic makes it. Paid scales it." sub="1 Publish → 2 Watch → 3 Paid test → 4 Winners shape next month's theme. Money only goes behind creative that has already proved itself." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Stat label={`Paid variants ready · ${month}`} value={`${ready} / ${PAID_MONTHLY_TARGET.max}`} sub={`Target ${PAID_MONTHLY_TARGET.min}–${PAID_MONTHLY_TARGET.max} fresh variants a month`} />
        <Stat label="Planned" value={variants.filter((v) => v.status === "planned").length} />
        <Stat label="In production" value={variants.filter((v) => v.status === "in_production").length} />
        <Stat label="Live" value={variants.filter((v) => v.status === "live").length} />
      </div>
      <Section title="Organic winners">
        {winners.length ? <table className="table"><thead><tr><th>Post</th><th>Franchise</th><th>Reach</th><th>Saves</th><th>Shares</th><th>Engagement</th><th>Subs</th><th>Rights (paid)</th><th></th></tr></thead><tbody>
          {winners.map((w) => { const r = contentRights(w.id, "paid"); return <tr key={w.id}><td><Link className="link" href={`/content/${w.id}`}>{w.title}</Link></td><td>{w.franchise}</td><td>{w.reach}</td><td>{w.saves}</td><td>{w.shares}</td><td>{w.eng ? `${(w.eng * 100).toFixed(1)}%` : "—"}</td><td>{w.subs ?? 0}</td>
            <td>{r.count ? <Rights s={r.weakest} /> : "—"}</td>
            <td>{r.count && r.weakest !== "cleared" ? <span className="text-xs text-hm">Not cleared for paid</span> : <form action={recommendForPaid}><input type="hidden" name="content_item_id" value={w.id} /><button className="btn btn-red">Recommend for paid</button></form>}</td></tr>; })}
        </tbody></table> : <Empty title="No performance data yet">Winners appear once published posts have numbers. Platform insights aren&apos;t connected yet, so enter numbers on each piece.</Empty>}
      </Section>
      <Section title="Variant tracker">
        {variants.length ? <table className="table"><thead><tr><th>Content</th><th>Variant</th><th>Status</th><th>Ad policy</th><th>Handed over</th><th>Notes</th></tr></thead><tbody>
          {variants.map((v) => <tr key={v.id}><td><Link className="link" href={`/content/${v.content_item_id}`}>{v.title}</Link></td><td>{PAID_KINDS.find((k) => k.key === v.kind)?.label}</td>
            <td><form action={savePaidVariant} className="flex gap-2"><input type="hidden" name="variant_id" value={v.id} /><input type="hidden" name="content_item_id" value={v.content_item_id} /><input type="hidden" name="handed_over" value="1" />
              <select name="status" defaultValue={v.status} className="select text-xs!">{["planned", "in_production", "ready", "live", "retired"].map((s) => <option key={s}>{s}</option>)}</select>
              <label className="text-xs flex gap-1 items-center"><input type="checkbox" name="ad_policy_checked" defaultChecked={!!v.ad_policy_checked} />ok</label><button className="text-xs underline">save</button></form></td>
            <td>{v.ad_policy_checked ? "✓" : "—"}</td><td className="text-xs">{v.handed_over_at?.slice(0, 10) ?? "—"}</td><td className="text-xs text-neutral-500">{v.notes}</td></tr>)}
        </tbody></table> : <Empty title="No variants planned" />}
      </Section>
    </div>
  );
}
