import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get, j } from "@/lib/db";
import { searchArchive } from "@/lib/archive/search";
import { transitionCheck, franchiseCheck, sixWeekStatus, contentRights, lastUsed, monthsAgo, type ContentItem, type Franchise } from "@/lib/rules";
import { JOBS, STAGES, SIDE_STAGES, FORMATS, PAID_KINDS, stageLabel, SOURCE_LABEL, nextStage } from "@/lib/constants";
import { PageHeader, Section, Jobs, Stage, Rights, IssueList, Source } from "@/components/ui";
import { updateContent, moveStage, addRef, removeRef, savePaidVariant, savePerformance, saveScene, moveScene, deleteScene } from "@/app/actions";

export default async function ContentItemPage({ params, searchParams }: PageProps<"/content/[id]">) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const item = get<ContentItem>("SELECT * FROM content_items WHERE id=?", id);
  if (!item) notFound();
  const f = item.franchise_id ? get<Franchise>("SELECT * FROM content_franchises WHERE id=?", item.franchise_id) : undefined;
  const franchises = all<{ id: number; name: string; tier: number }>("SELECT id, name, tier FROM content_franchises ORDER BY tier, id");
  const campaigns = all<{ id: number; name: string }>("SELECT id, name FROM campaigns ORDER BY start_date DESC");
  const themes = all<{ id: number; month: string; title: string }>("SELECT id, month, title FROM month_themes ORDER BY month DESC");
  const platforms = all<{ key: string; name: string }>("SELECT key, name FROM platforms");
  const users = all<{ name: string }>("SELECT name FROM users ORDER BY name");
  const jobs = j<string[]>(item.jobs, []);
  const brief = j<Record<string, unknown>>(item.brief, {});
  const refs = all<{ id: number; entity_type: string; entity_id: number; note: string | null }>("SELECT * FROM content_refs WHERE content_item_id=?", id);
  const rights = contentRights(id);
  const six = sixWeekStatus(item);
  const fIssues = f ? franchiseCheck(f, { id, subject: item.subject, brief }) : [];
  const next = nextStage(item.stage);
  const nextChecks = next ? transitionCheck(item, next) : [];
  const blocked = sp.blocked ? transitionCheck(item, String(sp.blocked)) : [];
  const frames = all<{ id: number; position: number; role: string; copy: string; artwork_ref: string | null; designer_note: string | null }>("SELECT * FROM content_frames WHERE content_item_id=? ORDER BY position", id);
  const claims = all<{ id: number; text: string; source_type: string; source_ref: string | null }>("SELECT * FROM content_claims WHERE content_item_id=?", id);
  const paid = all<{ id: number; kind: string; status: string; ad_policy_checked: number; handed_over_at: string | null }>("SELECT * FROM paid_variants WHERE content_item_id=?", id);
  const scenes = all<Record<string, string | number | null>>("SELECT * FROM storyboard_scenes WHERE content_item_id=? ORDER BY position", id);
  const perf = all<Record<string, number | string | null>>("SELECT * FROM performance_snapshots WHERE content_item_id=? ORDER BY captured_at DESC", id);
  const history = all<{ from_stage: string | null; to_stage: string; by: string; note: string | null; at: string }>("SELECT * FROM stage_events WHERE content_item_id=? ORDER BY id DESC LIMIT 20", id);
  const attachQ = String(sp.attach ?? "");
  const attachHits = attachQ ? searchArchive(attachQ, { limit: 12 }) : [];
  const people = refs.filter((r) => r.entity_type === "person").map((r) => ({ id: r.entity_id, name: get<{ name: string }>("SELECT name FROM people WHERE id=?", r.entity_id)?.name }));
  const label = (t: string, i: number) => {
    const m: Record<string, string> = { issue: "SELECT COALESCE('Vol. '||volume||' #'||issue_number, 'Issue '||id) l FROM issues WHERE id=?", issue_item: "SELECT title l FROM issue_items WHERE id=?", person: "SELECT name l FROM people WHERE id=?", artwork: "SELECT COALESCE(title, kind) l FROM artworks WHERE id=?", page: "SELECT 'Page '||page_number l FROM pages WHERE id=?", asset: "SELECT COALESCE(title, storage_path) l FROM assets WHERE id=?" };
    return (m[t] && get<{ l: string }>(m[t], i)?.l) || `${t} ${i}`;
  };
  const isVideo = (f?.tier ?? 1) > 1 || /video/i.test(item.format ?? "");

  return (
    <div>
      <PageHeader kicker={f ? `${f.name} · Tier ${f.tier}` : "No franchise"} title={item.title}
        sub={<span className="flex gap-2 items-center flex-wrap"><Stage s={item.stage} /> <Jobs jobs={jobs} /> {rights.count ? <>Rights <Rights s={rights.weakest} /></> : null} {item.publish_at && <span>Publishes {item.publish_at}{six.days != null ? ` (${six.days} days)` : ""}</span>}</span>}>
        <Link href="/content/pipeline" className="btn">Pipeline</Link>
      </PageHeader>

      {blocked.length > 0 && <div className="mb-6"><div className="kicker text-hm! mb-2">Can&apos;t move to {stageLabel(String(sp.blocked))}</div><IssueList issues={blocked.filter((b) => b.level === "block")} /></div>}
      {!jobs.length && <div className="mb-6 border-l-4 border-hm bg-hm/10 p-4"><b className="text-white">This concept does not currently have a clear Reach, Explore, Act or Return objective.</b> <span className="text-red-200">Which job should it perform? If it doesn&apos;t do one of these, we don&apos;t make it.</span></div>}

      <div className="grid xl:grid-cols-[1fr_380px] gap-8">
        <div>
          <form action={updateContent} className="card p-5 grid md:grid-cols-2 gap-4 mb-8">
            <input type="hidden" name="id" value={id} />
            <div className="md:col-span-2"><label className="label">Title</label><input name="title" defaultValue={item.title} className="input" /></div>
            <div><label className="label">Content franchise</label><select name="franchise_id" defaultValue={item.franchise_id ?? ""} className="select"><option value="">—</option>{franchises.map((x) => <option key={x.id} value={x.id}>T{x.tier} · {x.name}</option>)}</select></div>
            <div><label className="label">Format</label><select name="format" defaultValue={item.format ?? ""} className="select"><option value="">—</option>{FORMATS.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Strategic job (required)</label><div className="flex gap-4">{JOBS.map((jb) => <label key={jb} className="flex items-center gap-2 text-sm"><input type="checkbox" name="jobs" value={jb} defaultChecked={jobs.includes(jb)} />{jb}</label>)}</div>
              {f && <div className="text-xs text-neutral-500 mt-1">Strategy sets {f.name} as: {j<string[]>(f.jobs, []).join(" + ") || "not defined"}{f.job_rationale ? ` — ${f.job_rationale}` : ""}</div>}</div>
            <div className="md:col-span-2"><label className="label">Platforms</label><div className="flex gap-3 flex-wrap">{platforms.map((p) => <label key={p.key} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="platforms" value={p.key} defaultChecked={j<string[]>(item.platforms, []).includes(p.key)} />{p.name}</label>)}</div></div>
            <div><label className="label">Subject</label><input name="subject" defaultValue={item.subject ?? ""} className="input" /></div>
            <div><label className="label">Owner (decides)</label><input name="owner" list="users" defaultValue={item.owner ?? ""} className="input" /></div>
            {(["editor", "designer", "video_editor"] as const).map((k) => <div key={k}><label className="label">{k.replace("_", " ")}</label><input name={k} list="users" defaultValue={String((item as unknown as Record<string, string>)[k] ?? "")} className="input" /></div>)}
            <datalist id="users">{users.map((u) => <option key={u.name} value={u.name} />)}</datalist>
            <div><label className="label">Publish date</label><input type="date" name="publish_at" defaultValue={item.publish_at ?? ""} className="input" /></div>
            <div><label className="label">Deadline</label><input type="date" name="deadline" defaultValue={item.deadline ?? ""} className="input" /></div>
            <div><label className="label">Campaign</label><select name="campaign_id" defaultValue={item.campaign_id ?? ""} className="select"><option value="">Always-on</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Monthly theme</label><select name="month_theme_id" defaultValue={item.month_theme_id ?? ""} className="select"><option value="">—</option>{themes.map((t) => <option key={t.id} value={t.id}>{t.month} · {t.title}</option>)}</select></div>

            <div className="md:col-span-2 border-t border-line pt-4 kicker">Brief</div>
            <div className="md:col-span-2"><label className="label">The idea (one sentence)</label><input name="brief.idea" defaultValue={String(brief.idea ?? "")} className="input" /></div>
            <div><label className="label">Who it&apos;s for</label><input name="brief.audience" defaultValue={String(brief.audience ?? "")} className="input" /></div>
            <div><label className="label">What we want them to do</label><input name="brief.action" defaultValue={String(brief.action ?? "")} className="input" /></div>
            {f?.slug === "from-the-vault" && <div className="md:col-span-2"><label className="label">This matters because… (required)</label><input name="brief.whyNow" defaultValue={String(brief.whyNow ?? "")} className="input" placeholder="An anniversary, a theme link or a modern echo" /></div>}
            {f?.slug === "artist-spotlight" && <>
              <div><label className="label">Artist</label><select name="brief.personId" defaultValue={String(brief.personId ?? "")} className="select"><option value="">— attach the artist below —</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="label">The arc across the work</label><input name="brief.arc" defaultValue={String(brief.arc ?? "")} className="input" /></div></>}
            {f?.slug === "cover-story" && <div className="md:col-span-2"><input type="hidden" name="has_evidence" value="1" /><label className="label">What is the actual story? (at least one)</label><div className="flex gap-3 flex-wrap text-sm">
              {["rejected version", "retailer objection", "first appearance", "rough artwork", "production material", "documented incident"].map((e) => <label key={e} className="flex gap-1.5 items-center"><input type="checkbox" name="evidence" value={e} defaultChecked={(brief.evidence as string[] | undefined)?.includes(e)} />{e}</label>)}</div></div>}
            {f?.slug === "essential-reading" && <div className="md:col-span-2"><label className="label">The argument that ties the list together</label><input name="brief.argument" defaultValue={String(brief.argument ?? "")} className="input" /><div className="text-xs text-neutral-500 mt-1">Entries = the archive stories attached below (4–5 preferred).</div></div>}
            {f?.slug === "issue-guide" && <div className="text-xs text-neutral-500 md:col-span-2">Attach the issue below. Every story title, credit and page range must be Verified in the archive.</div>}
            {f?.slug === "chain-of-influence" && <div className="md:col-span-2"><label className="label">Links: one per line “claim | documented or similarity | source”</label><textarea name="lines.links" rows={4} className="textarea font-mono text-xs!" defaultValue={((brief.links as { claim: string; evidence?: string; source?: string }[]) ?? []).map((l) => `${l.claim} | ${l.evidence === "documented" ? "documented" : l.evidence ? "similarity" : ""} | ${l.source ?? ""}`).join("\n")} /></div>}
            {f?.slug === "history-of" && <div className="md:col-span-2"><label className="label">Timeline beats: one per line “date | beat | source” (max 6)</label><textarea name="lines.beats" rows={6} className="textarea font-mono text-xs!" defaultValue={((brief.beats as { date: string; text: string; source?: string }[]) ?? []).map((b) => `${b.date} | ${b.text} | ${b.source ?? ""}`).join("\n")} /></div>}

            <div className="md:col-span-2 border-t border-line pt-4 kicker">Copy</div>
            <div className="md:col-span-2"><label className="label">Caption</label><textarea name="caption" rows={6} defaultValue={item.caption ?? ""} className="textarea" /></div>
            <div><label className="label">CTA</label><input name="cta" defaultValue={item.cta ?? ""} className="input" /></div>
            <div><label className="label">Published URL</label><input name="published_url" defaultValue={item.published_url ?? ""} className="input" /></div>
            <div className="md:col-span-2 text-right"><button className="btn btn-red">Save</button></div>
          </form>

          {frames.length > 0 && <Section title="Carousel frames">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{frames.map((fr) => { const ar = j<{ label?: string; issue?: string; page?: number; crop?: string }>(fr.artwork_ref, {}); return (
              <div key={fr.id} className="card p-3 text-sm"><div className="flex justify-between"><span className="display text-xl text-hm">F{fr.position}</span><span className="chip">{fr.role}</span></div>
                <p className="mt-2 whitespace-pre-wrap">{fr.copy}</p>
                {ar.label && <p className="text-xs text-neutral-400 mt-2">🖼 {ar.label}{ar.page ? ` · p.${ar.page}` : ""}{ar.crop ? ` · crop: ${ar.crop}` : ""}</p>}
                {fr.designer_note && <p className="text-xs text-neutral-500 mt-1">Designer: {fr.designer_note}</p>}</div>); })}</div>
          </Section>}

          {claims.length > 0 && <Section title="Claims & sources">
            <table className="table"><tbody>{claims.map((c) => <tr key={c.id}><td><Source t={c.source_type} refText={c.source_ref} /></td><td>{c.text}</td><td className="text-xs text-neutral-500">{c.source_ref}</td></tr>)}</tbody></table>
            <p className="text-xs text-neutral-500 mt-2">{Object.values(SOURCE_LABEL).join(" · ")} are always shown separately.</p>
          </Section>}

          <Section title="Archive material used">
            {refs.length ? <table className="table"><tbody>{refs.map((r) => { const lu = lastUsed(r.entity_type, r.entity_id, id); const rr = rights.rows.find((x) => x.entity_type === r.entity_type && x.entity_id === r.entity_id); return (
              <tr key={r.id}><td className="text-neutral-500 text-xs">{r.entity_type.replace("_", " ")}</td><td>{label(r.entity_type, r.entity_id)}</td>
                <td>{rr && <Rights s={rr.status} />}</td><td className="text-xs text-neutral-500">{lu ? `Used ${monthsAgo(lu.published_at)} months ago on ${lu.platform}` : "Not used before"}</td>
                <td><form action={removeRef}><input type="hidden" name="id" value={id} /><input type="hidden" name="ref_id" value={r.id} /><button className="text-xs underline text-neutral-500">remove</button></form></td></tr>); })}</tbody></table>
              : <p className="text-sm text-neutral-500">Nothing attached yet. Rights and run-log checks need the archive material attached.</p>}
            <form className="flex gap-2 mt-4"><input name="attach" defaultValue={attachQ} className="input" placeholder="Search the archive to attach an issue, story, page, artwork or creator" /><button className="btn">Find</button></form>
            {attachHits.length > 0 && <div className="mt-2 space-y-1">{attachHits.map((h) => (
              <form key={`${h.entity_type}${h.entity_id}`} action={addRef} className="flex justify-between items-center card px-3 py-2 text-sm">
                <input type="hidden" name="id" value={id} /><input type="hidden" name="ref" value={`${h.entity_type}:${h.entity_id}`} />
                <span><span className="chip mr-2">{h.entity_type}</span>{h.title} <span className="text-neutral-500 text-xs">{h.issue_label}{h.page_number ? ` p.${h.page_number}` : ""}</span></span>
                <button className="btn">Attach</button>
              </form>))}
              {attachHits.filter((h) => h.entity_type === "issue_item").slice(0, 1).map((h) => get<{ id: number; name: string }>("SELECT p.id, p.name FROM credits c JOIN people p ON p.id=c.person_id WHERE c.target_type='issue_item' AND c.target_id=? LIMIT 1", h.entity_id)).filter(Boolean).map((p) => (
                <form key={p!.id} action={addRef} className="flex justify-between items-center card px-3 py-2 text-sm"><input type="hidden" name="id" value={id} /><input type="hidden" name="ref" value={`person:${p!.id}`} /><span><span className="chip mr-2">person</span>{p!.name}</span><button className="btn">Attach</button></form>))}
            </div>}
          </Section>

          {isVideo && <Section title="Storyboard">
            <div className="overflow-x-auto"><table className="table text-xs!"><thead><tr><th></th>{["scene", "timecode", "visual", "dialogue", "voiceover", "archive_insert", "overlay", "music", "sound", "edit_direction", "source_asset"].map((k) => <th key={k}>{k.replace("_", " ")}</th>)}<th></th></tr></thead>
              <tbody>{scenes.map((sc) => (
                <tr key={String(sc.id)}><td className="whitespace-nowrap">
                  <form action={moveScene} className="inline"><input type="hidden" name="scene_id" value={String(sc.id)} /><button name="dir" value="up" className="px-1">↑</button><button name="dir" value="down" className="px-1">↓</button></form></td>
                  {["scene", "timecode", "visual", "dialogue", "voiceover", "archive_insert", "overlay", "music", "sound", "edit_direction", "source_asset"].map((k) => <td key={k} className="min-w-[110px]">{String(sc[k] ?? "")}</td>)}
                  <td><form action={deleteScene}><input type="hidden" name="scene_id" value={String(sc.id)} /><input type="hidden" name="content_item_id" value={id} /><button className="underline text-neutral-500">del</button></form></td></tr>))}</tbody></table></div>
            <form action={saveScene} className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3 card p-3">
              <input type="hidden" name="content_item_id" value={id} />
              {["scene", "timecode", "visual", "dialogue", "voiceover", "archive_insert", "overlay", "music", "sound", "edit_direction", "source_asset"].map((k) => <input key={k} name={k} placeholder={k.replace("_", " ")} className="input text-xs!" />)}
              <button className="btn btn-red">Add scene</button>
            </form>
          </Section>}

          <Section title="Performance">
            {perf.length ? <table className="table"><thead><tr><th>Captured</th><th>Platform</th><th>Reach</th><th>Saves</th><th>Shares</th><th>Comments</th><th>Clicks</th><th>Subs</th><th>Source</th></tr></thead><tbody>
              {perf.map((p) => <tr key={String(p.id)}><td>{String(p.captured_at).slice(0, 10)}</td><td>{p.platform}</td><td>{p.reach}</td><td>{p.saves}</td><td>{p.shares}</td><td>{p.comments}</td><td>{p.link_clicks}</td><td>{p.subs_attributed}</td><td className="text-neutral-500">{p.source}</td></tr>)}</tbody></table>
              : <p className="text-sm text-neutral-500">No numbers yet. Platform APIs aren&apos;t connected; enter them by hand.</p>}
            <details className="card p-3 mt-3"><summary className="kicker cursor-pointer">Enter numbers</summary>
              <form action={savePerformance} className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3"><input type="hidden" name="content_item_id" value={id} />
                <select name="platform" className="select">{platforms.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                {["impressions", "reach", "views", "completion_rate", "watch_time", "saves", "shares", "comments", "likes", "link_clicks", "profile_visits", "subs_attributed", "paid_spend", "paid_subs"].map((k) => <input key={k} name={k} type="number" step="any" placeholder={k.replace("_", " ")} className="input text-xs!" />)}
                <button className="btn btn-red">Save</button></form></details>
          </Section>
        </div>

        <aside className="space-y-8">
          <div className="card p-4">
            <div className="kicker mb-3">Move stage</div>
            {item.stage === "internal_review" && <form action={moveStage} className="mb-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value="changes_requested" /><input name="note" className="input mb-1" placeholder="What needs changing?" /><button className="btn w-full justify-center">Request changes</button></form>}
            {next && <form action={moveStage} className="mb-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={next} />
              <button className="btn btn-red w-full justify-center">→ {stageLabel(next)}</button></form>}
            {nextChecks.length > 0 && <div className="mb-3"><IssueList issues={nextChecks} /></div>}
            {nextChecks.some((c) => c.level === "block") && <details className="mb-3 text-xs"><summary className="cursor-pointer text-neutral-400">Override a franchise rule (logged)</summary>
              <form action={moveStage} className="mt-2 space-y-2"><input type="hidden" name="id" value={id} /><input type="hidden" name="to" value={next ?? ""} />
                <input name="override_reason" className="input" placeholder="Why this rule doesn't apply" required /><button className="btn w-full justify-center">Override & move</button>
                <p className="text-neutral-500">Job, rights, CTA and caption gates can&apos;t be overridden.</p></form></details>}
            <form action={moveStage} className="flex gap-2"><input type="hidden" name="id" value={id} />
              <select name="to" className="select" defaultValue={item.stage}>{[...STAGES, ...SIDE_STAGES].map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <button className="btn">Set</button></form>
          </div>

          {six.flags.length > 0 && <div><div className="kicker mb-2">Six-week schedule</div><IssueList issues={six.flags} /></div>}

          {f && <div className="card p-4 text-sm">
            <div className="kicker mb-2">{f.name} rules</div>
            {fIssues.length ? <IssueList issues={fIssues} /> : <p className="text-green-500 text-xs">All franchise checks pass.</p>}
            {f.format_spec && <p className="mt-3 text-neutral-300"><b>Format:</b> {f.format_spec}</p>}
            {f.effort && <p className="mt-1 text-neutral-400"><b>Effort:</b> {f.effort}</p>}
            {j<string[]>(f.how_we_make_it, []).length > 0 && <ul className="mt-3 space-y-1 text-neutral-400">{j<string[]>(f.how_we_make_it, []).map((h) => <li key={h}>☐ {h}</li>)}</ul>}
            {f.watch_out && <p className="mt-3 border-l-2 border-hm pl-3 text-neutral-300"><b>Watch out:</b> {f.watch_out}</p>}
          </div>}

          <div className="card p-4">
            <div className="kicker mb-2">Paid variants</div>
            {paid.map((p) => (
              <form key={p.id} action={savePaidVariant} className="flex gap-2 items-center mb-2 text-sm"><input type="hidden" name="variant_id" value={p.id} /><input type="hidden" name="content_item_id" value={id} />
                <span className="w-24">{PAID_KINDS.find((k) => k.key === p.kind)?.label}</span>
                <select name="status" defaultValue={p.status} className="select text-xs!">{["planned", "in_production", "ready", "live", "retired"].map((s) => <option key={s}>{s}</option>)}</select>
                <label className="text-xs flex gap-1 items-center" title="Ad-policy checked"><input type="checkbox" name="ad_policy_checked" defaultChecked={!!p.ad_policy_checked} />policy</label>
                <input type="hidden" name="handed_over" value="1" /><button className="text-xs underline">save</button></form>))}
            <form action={savePaidVariant} className="flex gap-2 mt-2"><input type="hidden" name="content_item_id" value={id} /><input type="hidden" name="month" value={item.publish_at?.slice(0, 7) ?? ""} />
              <select name="kind" className="select text-xs!">{PAID_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select><button className="btn">Plan</button></form>
            {f && <p className="text-[11px] text-neutral-500 mt-2">Suggested for {f.name}: {j<string[]>(f.paid_outputs, []).map((k) => PAID_KINDS.find((x) => x.key === k)?.label).join(", ")}</p>}
          </div>

          <div><div className="kicker mb-2">History</div><ul className="text-xs text-neutral-500 space-y-1">{history.map((h, i) => <li key={i}>{h.at.slice(0, 16)} · {h.by}: {h.from_stage ? `${stageLabel(h.from_stage)} → ` : ""}{stageLabel(h.to_stage)}{h.note ? ` — ${h.note}` : ""}</li>)}</ul></div>
        </aside>
      </div>
    </div>
  );
}
