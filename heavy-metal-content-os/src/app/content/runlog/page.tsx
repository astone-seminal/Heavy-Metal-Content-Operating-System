import Link from "next/link";
import { all } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";

export default async function RunLog({ searchParams }: PageProps<"/content/runlog">) {
  const sp = await searchParams;
  const type = String(sp.type ?? ""), platform = String(sp.platform ?? ""), q = String(sp.q ?? ""), since = String(sp.since ?? "");
  const freq = all<{ entity_type: string; entity_id: number; entity_label: string; uses: number; last: string; platforms: string }>(`
    SELECT entity_type, entity_id, entity_label, COUNT(DISTINCT content_item_id) uses, MAX(published_at) last, GROUP_CONCAT(DISTINCT platform) platforms FROM run_log
    WHERE (?='' OR entity_type=?) AND (?='' OR platform=?) AND (?='' OR entity_label LIKE ?) AND (?='' OR published_at>=?)
    GROUP BY entity_type, entity_id ORDER BY ${sp.sort === "last" ? "last DESC" : "uses DESC, last DESC"} LIMIT 300`, type, type, platform, platform, q, `%${q}%`, since, since);
  const log = all<{ id: number; published_at: string; platform: string; entity_type: string; entity_label: string; content_item_id: number; title: string; url: string | null; campaign: string | null; franchise: string | null }>(`
    SELECT l.*, c.title, k.name campaign, f.name franchise FROM run_log l LEFT JOIN content_items c ON c.id=l.content_item_id LEFT JOIN campaigns k ON k.id=c.campaign_id LEFT JOIN content_franchises f ON f.id=c.franchise_id
    WHERE (?='' OR l.entity_type=?) AND (?='' OR l.platform=?) AND (?='' OR l.entity_label LIKE ?) AND (?='' OR l.published_at>=?) ORDER BY l.published_at DESC LIMIT 200`, type, type, platform, platform, q, `%${q}%`, since, since);
  return (
    <div>
      <PageHeader kicker="Content" title="Run log" sub="Every artwork, issue, story, artist and franchise we publish is recorded automatically when a piece moves to Published. The AI and the rules engine check it before recommending anything." />
      <form className="grid md:grid-cols-5 gap-2 mb-6">
        <input name="q" defaultValue={q} className="input" placeholder="Search label" />
        <select name="type" defaultValue={type} className="select"><option value="">All types</option>{["artwork", "issue", "issue_item", "person", "franchise", "page", "asset"].map((t) => <option key={t}>{t}</option>)}</select>
        <input name="platform" defaultValue={platform} className="input" placeholder="Platform key" />
        <input name="since" type="date" defaultValue={since} className="input" />
        <div className="flex gap-2"><select name="sort" defaultValue={String(sp.sort ?? "")} className="select"><option value="">Most used</option><option value="last">Last used</option></select><button className="btn">Filter</button></div>
      </form>
      {freq.length ? <div className="grid xl:grid-cols-2 gap-8">
        <div><div className="kicker mb-2">Frequency</div><table className="table"><thead><tr><th>Type</th><th>Item</th><th>Uses</th><th>Last used</th><th>Platforms</th></tr></thead><tbody>
          {freq.map((f) => <tr key={`${f.entity_type}${f.entity_id}`}><td className="text-neutral-500">{f.entity_type}</td><td>{f.entity_label}</td><td className={f.uses >= 6 ? "text-hm font-bold" : ""}>{f.uses}</td><td>{f.last.slice(0, 10)}</td><td className="text-xs">{f.platforms}</td></tr>)}</tbody></table></div>
        <div><div className="kicker mb-2">Log</div><table className="table"><thead><tr><th>Date</th><th>Platform</th><th>Used</th><th>In</th></tr></thead><tbody>
          {log.map((l) => <tr key={l.id}><td>{l.published_at.slice(0, 10)}</td><td>{l.platform}</td><td><span className="text-neutral-500 text-xs">{l.entity_type}</span> {l.entity_label}</td><td><Link className="link" href={`/content/${l.content_item_id}`}>{l.title}</Link><div className="text-xs text-neutral-500">{l.franchise}{l.campaign ? ` · ${l.campaign}` : ""}</div></td></tr>)}</tbody></table></div>
      </div> : <Empty title="Nothing published yet">Entries appear when content moves to Published.</Empty>}
    </div>
  );
}
