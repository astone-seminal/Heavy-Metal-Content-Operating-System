import Link from "next/link";
import { all, j } from "@/lib/db";
import { STAGES, SIDE_STAGES } from "@/lib/constants";
import { sixWeekStatus, contentRights, type ContentItem } from "@/lib/rules";
import { PageHeader, Jobs, Rights } from "@/components/ui";

type Row = ContentItem & { franchise: string | null; tier: number | null; campaign: string | null; paid: number };

export default async function Pipeline({ searchParams }: PageProps<"/content/pipeline">) {
  const sp = await searchParams;
  const tier = String(sp.tier ?? "");
  const rows = all<Row>(`SELECT c.*, f.name franchise, f.tier, k.name campaign, (SELECT COUNT(*) FROM paid_variants p WHERE p.content_item_id=c.id) paid
    FROM content_items c LEFT JOIN content_franchises f ON f.id=c.franchise_id LEFT JOIN campaigns k ON k.id=c.campaign_id
    WHERE (?='' OR f.tier=?) ORDER BY c.publish_at IS NULL, c.publish_at`, tier, tier);
  const cols = [...STAGES];
  return (
    <div>
      <PageHeader kicker="Content" title="Pipeline" sub="Every piece from idea to published. Gates enforce the strategy: no job, no brief; uncleared, no publish.">
        {["", "1", "2", "3"].map((t) => <Link key={t} href={`/content/pipeline${t ? `?tier=${t}` : ""}`} className={`btn ${tier === t ? "border-hm!" : ""}`}>{t ? `Tier ${t}` : "All"}</Link>)}
        <Link href="/content/new" className="btn btn-red">New piece</Link>
      </PageHeader>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {cols.map((c) => {
          const items = rows.filter((r) => r.stage === c.key);
          return (
            <div key={c.key} className="w-64 shrink-0">
              <div className="flex justify-between items-baseline mb-2 border-b-2 border-hm pb-1"><span className="display text-lg">{c.label}</span><span className="text-xs text-neutral-500">{items.length}</span></div>
              <div className="space-y-2">{items.map((r) => <Card key={r.id} r={r} />)}</div>
            </div>
          );
        })}
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {SIDE_STAGES.map((s) => { const items = rows.filter((r) => r.stage === s.key); return (
          <div key={s.key}><div className="display text-lg mb-2 text-neutral-400">{s.label} <span className="text-xs">{items.length}</span></div><div className="space-y-2">{items.map((r) => <Card key={r.id} r={r} />)}</div></div>); })}
      </div>
    </div>
  );
}

function Card({ r }: { r: Row }) {
  const six = sixWeekStatus(r);
  const rights = contentRights(r.id);
  return (
    <Link href={`/content/${r.id}`} className={`block card p-3 text-sm hover:border-neutral-500 ${six.flags.some((f) => f.level === "block") ? "border-l-4! border-l-hm!" : six.flags.length ? "border-l-4! border-l-amber-500!" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{r.franchise ?? "No franchise"}{r.tier ? ` · T${r.tier}` : ""}</div>
      <div className="font-semibold text-white leading-snug mt-0.5">{r.title}</div>
      <div className="mt-2"><Jobs jobs={j<string[]>(r.jobs, [])} /></div>
      <div className="text-xs text-neutral-500 mt-2 flex flex-wrap gap-x-2">
        {r.publish_at && <span>{r.publish_at}{six.days != null ? ` (${six.days}d)` : ""}</span>}
        <span>{j<string[]>(r.platforms, []).join(", ")}</span>{r.owner && <span>· {r.owner}</span>}{r.campaign && <span>· {r.campaign}</span>}
      </div>
      <div className="flex gap-1 mt-2 flex-wrap items-center">{rights.count > 0 && <Rights s={rights.weakest} />}{!r.cta && <span className="chip text-neutral-500">No CTA</span>}<span className="chip text-neutral-500">{r.paid} paid</span></div>
      {six.flags.map((f, i) => <div key={i} className="text-[11px] mt-2 text-amber-300">{f.message}</div>)}
    </Link>
  );
}
