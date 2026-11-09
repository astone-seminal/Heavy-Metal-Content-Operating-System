import Link from "next/link";
import { all, get, j } from "@/lib/db";
import { monthHealth, weekHealth, sixWeekStatus, type ContentItem } from "@/lib/rules";
import { SIX_WEEK, stageRank, stageLabel } from "@/lib/constants";
import { PageHeader, IssueList, Jobs, Section, Stage } from "@/components/ui";
import { saveTheme, requestRightsBatch } from "@/app/actions";

type Row = ContentItem & { franchise: string | null; tier: number | null };
const VIEWS = ["month", "week", "timeline", "platform", "production"] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monday = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };

export default async function Calendar({ searchParams }: PageProps<"/content/calendar">) {
  const sp = await searchParams;
  const view = (VIEWS as readonly string[]).includes(String(sp.view)) ? String(sp.view) : "month";
  const now = new Date();
  const month = String(sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const prev = iso(new Date(Date.UTC(y, m - 2, 1))).slice(0, 7), next = iso(new Date(Date.UTC(y, m, 1))).slice(0, 7);
  const health = monthHealth(month);
  const items = all<Row>(`SELECT c.*, f.name franchise, f.tier FROM content_items c LEFT JOIN content_franchises f ON f.id=c.franchise_id WHERE substr(c.publish_at,1,7)=? AND c.stage!='rejected' ORDER BY c.publish_at`, month);
  const theme = get<Record<string, string | number | null>>("SELECT * FROM month_themes WHERE month=?", month);
  const campaigns = all<{ id: number; name: string }>("SELECT id, name FROM campaigns");
  const weekStart = String(sp.week ?? iso(monday(view === "week" && sp.week ? new Date(String(sp.week)) : first.getTime() > now.getTime() ? first : now)));
  const href = (o: Record<string, string>) => `/content/calendar?${new URLSearchParams({ view, month, ...o })}`;
  const sixWeekThemeDue = new Date(first.getTime() - 42 * 86400000);

  return (
    <div>
      <PageHeader kicker="Content · Calendar" title={first.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
        sub={`Planned six weeks ahead. Theme due ${iso(sixWeekThemeDue)} (W−6), rights cleared by ${iso(new Date(first.getTime() - 28 * 86400000))} (W−4) for the first post of the month.`}>
        <Link href={href({ month: prev })} className="btn">←</Link><Link href={href({ month: next })} className="btn">→</Link>
        {VIEWS.map((v) => <Link key={v} href={`/content/calendar?view=${v}&month=${month}`} className={`btn ${view === v ? "border-hm! text-white" : ""}`}>{v}</Link>)}
      </PageHeader>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 mb-8">
        <div className="card p-5">
          <div className="kicker mb-2">Monthly theme</div>
          {theme ? <><div className="display text-4xl text-white">{theme.title}</div><p className="text-neutral-300 mt-2">{theme.reason}</p>
            {theme.primary_stories && <p className="text-sm text-neutral-400 mt-2"><b>Primary stories:</b> {theme.primary_stories}</p>}
            {theme.paid_opportunities && <p className="text-sm text-neutral-400 mt-1"><b>Paid opportunities:</b> {theme.paid_opportunities}</p>}</>
            : <p className="text-hm">No theme set for this month.</p>}
          <details className="mt-4"><summary className="kicker cursor-pointer">{theme ? "Edit" : "Set"} theme</summary>
            <form action={saveTheme} className="grid md:grid-cols-2 gap-3 mt-3"><input type="hidden" name="month" value={month} />
              <div className="md:col-span-2"><label className="label">Theme</label><input name="title" className="input" defaultValue={String(theme?.title ?? "")} required /></div>
              <div className="md:col-span-2"><label className="label">Reason</label><textarea name="reason" className="textarea" rows={2} defaultValue={String(theme?.reason ?? "")} /></div>
              <div><label className="label">Primary stories</label><input name="primary_stories" className="input" defaultValue={String(theme?.primary_stories ?? "")} /></div>
              <div><label className="label">Campaign</label><select name="campaign_id" className="select" defaultValue={String(theme?.campaign_id ?? "")}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="md:col-span-2"><label className="label">Paid opportunities</label><input name="paid_opportunities" className="input" defaultValue={String(theme?.paid_opportunities ?? "")} /></div>
              <div><button className="btn btn-red">Save theme</button></div></form></details>
        </div>
        <div>
          <div className="kicker mb-2">Month health</div>
          <IssueList issues={health.issues} empty="No gaps found." />
          <form action={requestRightsBatch} className="mt-4"><input type="hidden" name="month" value={month} /><button className="btn w-full justify-center">Send month&apos;s uncleared assets to Colburn</button></form>
          <p className="text-[11px] text-neutral-500 mt-1">Marks every un-requested archive asset on this month&apos;s content as Requested (one batch).</p>
        </div>
      </div>

      {view === "month" && <MonthGrid first={first} items={items} />}
      {view === "week" && <Week start={weekStart} href={href} />}
      {view === "timeline" && <Timeline items={items} />}
      {view === "platform" && <Platform first={first} items={items} />}
      {view === "production" && <Production items={items} />}
    </div>
  );
}

function MonthGrid({ first, items }: { first: Date; items: Row[] }) {
  const start = monday(first);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000));
  const weeks = [0, 1, 2, 3, 4, 5].map((w) => days.slice(w * 7, w * 7 + 7)).filter((w) => w.some((d) => d.getUTCMonth() === first.getUTCMonth()));
  return (
    <div>
      <div className="grid grid-cols-7 gap-px bg-line border border-line">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-black kicker p-2">{d}</div>)}
        {weeks.flat().map((d) => { const ds = iso(d); const its = items.filter((i) => i.publish_at?.slice(0, 10) === ds); const out = d.getUTCMonth() !== first.getUTCMonth(); return (
          <div key={ds} className={`bg-ink min-h-28 p-1.5 ${out ? "opacity-30" : ""}`}>
            <div className="text-xs text-neutral-500 flex justify-between">{d.getUTCDate()}{!out && !its.some((i) => j<string[]>(i.platforms, []).includes("instagram")) && <span className="text-hm text-[10px]">no IG</span>}</div>
            {its.map((i) => { const fl = sixWeekStatus(i).flags; return (
              <Link key={i.id} href={`/content/${i.id}`} className={`block text-[11px] leading-tight mt-1 px-1.5 py-1 border-l-2 ${fl.length ? "border-amber-500" : i.stage === "published" ? "border-green-600" : "border-hm"} bg-neutral-900 hover:bg-neutral-800`}>
                <div className="font-semibold text-white truncate">{i.title}</div><div className="text-neutral-500 truncate">{i.franchise ?? "—"} · {j<string[]>(i.jobs, []).join("/") || "NO JOB"}</div></Link>); })}
          </div>); })}
      </div>
      <div className="mt-6 space-y-2">{weeks.map((w) => { const h = weekHealth(iso(w[0])); return h.issues.length ? (
        <div key={iso(w[0])} className="text-sm"><span className="kicker mr-2">Week of {iso(w[0])}</span>{h.issues.slice(0, 4).map((i) => <span key={i.code} className="inline-block mr-3 text-amber-200/90">{i.message}</span>)}</div>) : null; })}</div>
    </div>
  );
}

function Week({ start, href }: { start: string; href: (o: Record<string, string>) => string }) {
  const h = weekHealth(start);
  const s = new Date(start + "T00:00:00Z");
  const days = Array.from({ length: 7 }, (_, i) => iso(new Date(s.getTime() + i * 86400000)));
  return (
    <div>
      <div className="flex gap-2 mb-4"><Link className="btn" href={href({ view: "week", week: iso(new Date(s.getTime() - 7 * 86400000)) })}>← week</Link><span className="display text-2xl">Week of {start}</span><Link className="btn" href={href({ view: "week", week: iso(new Date(s.getTime() + 7 * 86400000)) })}>week →</Link></div>
      <div className="grid md:grid-cols-7 gap-2 mb-6">{days.map((d) => (
        <div key={d} className="card p-2 min-h-40"><div className="kicker">{new Date(d).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" })}</div>
          {h.items.filter((i) => i.publish_at?.slice(0, 10) === d).map((i) => <Link key={i.id} href={`/content/${i.id}`} className="block text-xs mt-2 border-l-2 border-hm pl-2"><b>{i.title}</b><div className="text-neutral-500">{i.franchise}</div><Jobs jobs={j<string[]>(i.jobs, [])} /></Link>)}</div>))}</div>
      <div className="grid md:grid-cols-2 gap-8">
        <div><div className="kicker mb-2">Cadence vs strategy</div><table className="table"><tbody>{h.cadence.map((c) => <tr key={c.key}><td>{c.name}</td><td className={c.cadence_min && c.planned < c.cadence_min ? "text-hm" : "text-green-500"}>{c.planned}</td><td className="text-neutral-500">target {c.cadence_min}{c.cadence_max !== c.cadence_min ? `–${c.cadence_max}` : ""}/wk</td></tr>)}</tbody></table></div>
        <div><div className="kicker mb-2">Job mix</div><div className="flex gap-3 mb-4">{Object.entries(h.jobs).map(([k, v]) => <div key={k} className="card p-3 text-center flex-1"><div className="display text-3xl">{v}</div><div className="kicker">{k}</div></div>)}</div><IssueList issues={h.issues} empty="Week looks balanced." /></div>
      </div>
    </div>
  );
}

function Timeline({ items }: { items: Row[] }) {
  return (
    <Section title="Six-week timeline">
      <div className="space-y-2">{items.map((i) => { const st = sixWeekStatus(i); const cur = stageRank(i.stage); return (
        <Link key={i.id} href={`/content/${i.id}`} className="grid grid-cols-[240px_1fr] gap-4 items-center card p-2 hover:border-neutral-500">
          <div className="text-sm"><b>{i.title}</b><div className="text-xs text-neutral-500">{i.publish_at} · {st.days}d · <Stage s={i.stage} /></div></div>
          <div className="grid grid-cols-6 gap-1">{SIX_WEEK.map((m) => { const due = st.days != null && st.days <= m.days; const done = cur >= stageRank(m.minStage); return (
            <div key={m.key} title={m.note} className={`text-[10px] px-1.5 py-1 text-center ${done ? "bg-green-900/60 text-green-300" : due ? "bg-hm/70 text-white" : "bg-neutral-900 text-neutral-500"}`}>{m.key} {m.label}</div>); })}</div>
        </Link>); })}</div>
      <p className="text-xs text-neutral-500 mt-3">Green = milestone met. Red = milestone due and not met. Grey = not due yet.</p>
    </Section>
  );
}

function Platform({ first, items }: { first: Date; items: Row[] }) {
  const platforms = all<{ key: string; name: string; cadence_min: number | null; cadence_period: string | null }>("SELECT key, name, cadence_min, cadence_period FROM platforms");
  const n = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const days = Array.from({ length: n }, (_, i) => iso(new Date(first.getTime() + i * 86400000)));
  return (
    <div className="overflow-x-auto"><table className="table text-xs!"><thead><tr><th>Platform</th>{days.map((d) => <th key={d} className="text-center! px-1!">{Number(d.slice(8))}</th>)}<th>Total</th><th>Expected</th></tr></thead><tbody>
      {platforms.map((p) => { const counts = days.map((d) => items.filter((i) => i.publish_at?.slice(0, 10) === d && j<string[]>(i.platforms, []).includes(p.key)).length); const total = counts.reduce((a, b) => a + b, 0);
        const exp = p.cadence_period === "week" ? Math.round((p.cadence_min ?? 0) * n / 7) : p.cadence_period === "month" ? p.cadence_min : null; return (
        <tr key={p.key}><td className="font-semibold">{p.name}</td>{counts.map((c, k) => <td key={k} className={`text-center! px-1! ${c ? "bg-hm/40 text-white" : ""}`}>{c || ""}</td>)}<td>{total}</td><td className={exp && total < exp ? "text-hm" : "text-neutral-500"}>{exp ?? p.cadence_period ?? "—"}</td></tr>); })}
    </tbody></table></div>
  );
}

function Production({ items }: { items: Row[] }) {
  const groups = SIX_WEEK.map((m) => ({ m, items: items.filter((i) => { const st = sixWeekStatus(i); return st.phase?.key === m.key; }) }));
  const later = items.filter((i) => !sixWeekStatus(i).phase);
  return (
    <div className="grid md:grid-cols-3 xl:grid-cols-7 gap-3">
      <Col title="More than 6 weeks out" items={later} />
      {groups.map((g) => <Col key={g.m.key} title={`${g.m.key} · ${g.m.label}`} note={g.m.note} items={g.items} />)}
    </div>
  );
}
function Col({ title, note, items }: { title: string; note?: string; items: Row[] }) {
  return (
    <div><div className="display text-lg border-b-2 border-hm pb-1">{title}</div>{note && <div className="text-[11px] text-neutral-500 mt-1">{note}</div>}
      <div className="space-y-2 mt-2">{items.map((i) => { const fl = sixWeekStatus(i).flags; return (
        <Link key={i.id} href={`/content/${i.id}`} className="block card p-2 text-xs"><b className="text-white">{i.title}</b><div className="text-neutral-500">{stageLabel(i.stage)} · {i.publish_at}</div>{fl.map((f, k) => <div key={k} className="text-amber-300 mt-1">{f.message}</div>)}</Link>); })}</div></div>
  );
}
