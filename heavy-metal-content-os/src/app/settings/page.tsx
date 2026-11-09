import { all, j } from "@/lib/db";
import { aiAvailable, MODEL } from "@/lib/ai/claude";
import { JOBS, PAID_KINDS } from "@/lib/constants";
import type { Franchise } from "@/lib/rules";
import { PageHeader, Section } from "@/components/ui";
import { saveFranchise, saveRole, saveUser, savePlatform } from "@/app/actions";

const INTEGRATIONS = [
  ["Heavy Metal AI (Anthropic Claude)", aiAvailable() ? `Connected · ${MODEL}` : "Not connected — set ANTHROPIC_API_KEY", "MVP"],
  ["Instagram (Meta Graph API: publish + insights)", "Not connected — needs Meta app review", "Phase 2"],
  ["Facebook Pages API", "Not connected", "Phase 2"],
  ["YouTube Data + Analytics API", "Not connected", "Phase 2"],
  ["TikTok Content Posting API", "Not connected — needs TikTok audit", "Phase 3"],
  ["X API v2 / LinkedIn Community Management", "Not connected", "Phase 3"],
  ["GA4, Shopify, Klaviyo, subscription platform", "Not connected", "Phase 3"],
  ["Notion (Heavy Metal Content database sync)", "Not connected", "Phase 2"],
  ["Storage", "Local disk (storage/) — S3/R2 in Phase 2", "MVP"],
  ["Sign-in", "Single named user — Google Workspace SSO in Phase 2", "MVP"],
];

export default function Settings() {
  const fs = all<Franchise>("SELECT * FROM content_franchises ORDER BY tier, id");
  const roles = all<{ id: number; name: string; owns: string; status: string }>("SELECT * FROM roles ORDER BY id");
  const users = all<{ id: number; name: string; email: string | null; role: string | null }>("SELECT u.*, r.name role FROM users u LEFT JOIN roles r ON r.id=u.role_id");
  const platforms = all<{ id: number; name: string; role: string | null; cadence_min: number | null; cadence_max: number | null; cadence_period: string | null; owner_role: string | null; api_status: string }>("SELECT * FROM platforms");
  return (
    <div>
      <PageHeader kicker="Settings" title="The rulebook" sub="Franchises, platform cadence and ownership are data, not code. Change them here and every rule check, generator and calendar warning follows." />
      <Section title="Integrations">
        <table className="table"><tbody>{INTEGRATIONS.map(([n, s, p]) => <tr key={n}><td className="font-semibold">{n}</td><td className={s.startsWith("Connected") ? "text-green-500" : "text-neutral-400"}>{s}</td><td className="text-neutral-500">{p}</td></tr>)}</tbody></table>
      </Section>
      <Section title="19 content franchises">
        <p className="text-sm text-neutral-500 -mt-2 mb-4">Imported from the Heavy Metal Content Hub in Notion. Franchises marked “missing” had no definition there; add them from the strategy deck.</p>
        <div className="space-y-2">{fs.map((f) => (
          <details key={f.id} className="card">
            <summary className="p-3 cursor-pointer flex justify-between"><span><b>{f.name}</b> <span className="text-neutral-500 text-xs">Tier {f.tier}</span></span>
              <span className={`chip ${f.definition_status === "complete" ? "border-green-700 text-green-500" : f.definition_status === "partial" ? "border-amber-600 text-amber-400" : "border-hm text-hm"}`}>{f.definition_status}</span></summary>
            <form action={saveFranchise} className="grid md:grid-cols-2 gap-3 p-4 border-t border-line">
              <input type="hidden" name="id" value={f.id} />
              <div className="md:col-span-2"><label className="label">What it is</label><textarea name="description" rows={2} className="textarea" defaultValue={f.description ?? ""} /></div>
              <div><label className="label">Jobs</label><div className="flex gap-3 text-sm">{JOBS.map((x) => <label key={x} className="flex gap-1 items-center"><input type="checkbox" name="jobs" value={x} defaultChecked={j<string[]>(f.jobs, []).includes(x)} />{x}</label>)}</div></div>
              <div><label className="label">Job rationale</label><input name="job_rationale" className="input" defaultValue={f.job_rationale ?? ""} /></div>
              <div className="md:col-span-2"><label className="label">Format (frames like “F1 the cover full-bleed.” are parsed into the structure)</label><textarea name="format_spec" rows={2} className="textarea" defaultValue={f.format_spec ?? ""} /></div>
              <div><label className="label">Effort / production time</label><input name="effort" className="input" defaultValue={f.effort ?? ""} /></div>
              <div><label className="label">Platforms (one per line)</label><textarea name="platforms" rows={2} className="textarea" defaultValue={j<string[]>(f.platforms, []).join("\n")} /></div>
              <div className="md:col-span-2"><label className="label">How we make it (one per line)</label><textarea name="how_we_make_it" rows={4} className="textarea" defaultValue={j<string[]>(f.how_we_make_it, []).join("\n")} /></div>
              <div><label className="label">Research requirements</label><textarea name="research_requirements" rows={2} className="textarea" defaultValue={f.research_requirements ?? ""} /></div>
              <div><label className="label">Rights requirements</label><textarea name="rights_requirements" rows={2} className="textarea" defaultValue={f.rights_requirements ?? ""} /></div>
              <div><label className="label">CTA requirements</label><input name="cta_requirements" className="input" defaultValue={f.cta_requirements ?? ""} /></div>
              <div><label className="label">Paid outputs</label><div className="flex gap-2 flex-wrap text-xs">{PAID_KINDS.map((k) => <label key={k.key} className="flex gap-1 items-center"><input type="checkbox" name="paid_outputs" value={k.key} defaultChecked={j<string[]>(f.paid_outputs, []).includes(k.key)} />{k.label}</label>)}</div></div>
              <div className="md:col-span-2"><label className="label">Watch out</label><textarea name="watch_out" rows={2} className="textarea" defaultValue={f.watch_out ?? ""} /></div>
              <div className="md:col-span-2"><label className="label">Example caption</label><textarea name="example_caption" rows={3} className="textarea" defaultValue={f.example_caption ?? ""} /></div>
              {j<{ text: string; source: string }[]>(f.rule_notes, []).length > 0 && <div className="md:col-span-2 text-xs text-neutral-400"><div className="kicker mb-1">Rules enforced in code</div>{j<{ text: string; source: string }[]>(f.rule_notes, []).map((r) => <div key={r.text}>■ {r.text} <span className="text-neutral-600">({r.source})</span></div>)}</div>}
              <div className="text-xs text-neutral-600 md:col-span-2">Sources: {j<string[]>(f.source_refs, []).join(" · ")}</div>
              <div><button className="btn btn-red">Save</button></div>
            </form>
          </details>))}</div>
      </Section>
      <Section title="Platform cadence">
        <table className="table"><thead><tr><th>Platform</th><th>Role</th><th>Min</th><th>Max</th><th>Per</th><th>Owner</th><th></th></tr></thead><tbody>
          {platforms.map((p) => <tr key={p.id}><td colSpan={7} className="p-0!"><form action={savePlatform} className="grid grid-cols-[140px_1fr_70px_70px_100px_200px_50px] gap-2 items-center px-2 py-1"><input type="hidden" name="id" value={p.id} />
            <b>{p.name}</b><span className="text-neutral-400 text-xs">{p.role}</span><input name="cadence_min" defaultValue={p.cadence_min ?? ""} className="input" /><input name="cadence_max" defaultValue={p.cadence_max ?? ""} className="input" />
            <select name="cadence_period" defaultValue={p.cadence_period ?? ""} className="select"><option value="">—</option>{["day", "week", "month", "drop"].map((x) => <option key={x}>{x}</option>)}</select>
            <input name="owner_role" defaultValue={p.owner_role ?? ""} className="input" /><button className="text-xs underline">save</button></form></td></tr>)}</tbody></table>
      </Section>
      <Section title="Roles & ownership">
        <div className="space-y-1">{roles.map((r) => (
          <form key={r.id} action={saveRole} className="grid md:grid-cols-[220px_1fr_180px_60px] gap-2 items-center"><input type="hidden" name="id" value={r.id} />
            <input name="name" defaultValue={r.name} className="input" /><input name="owns" defaultValue={j<string[]>(r.owns, []).join(", ")} className="input" /><input name="status" defaultValue={r.status ?? ""} className="input" /><button className="text-xs underline">save</button></form>))}
          <form action={saveRole} className="grid md:grid-cols-[220px_1fr_180px_60px] gap-2 items-center pt-2"><input name="name" placeholder="New role" className="input" required /><input name="owns" placeholder="owns (comma separated)" className="input" /><input name="status" placeholder="status" className="input" /><button className="btn">Add</button></form>
        </div>
      </Section>
      <Section title="People">
        <table className="table"><tbody>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td></tr>)}</tbody></table>
        <form action={saveUser} className="flex gap-2 mt-3"><input name="name" placeholder="Name" required className="input" /><input name="email" placeholder="Email" className="input" /><select name="role_id" className="select">{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><button className="btn">Add</button></form>
      </Section>
    </div>
  );
}
