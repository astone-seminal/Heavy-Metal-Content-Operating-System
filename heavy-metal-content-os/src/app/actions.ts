"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { all, get, j, run, tx } from "@/lib/db";
import { transitionCheck, type ContentItem } from "@/lib/rules";
import { JOBS } from "@/lib/constants";
import { reindexIssue } from "@/lib/archive/search";

const s = (f: FormData, k: string) => { const v = f.get(k); return v == null || v === "" ? null : String(v); };
const arr = (f: FormData, k: string) => f.getAll(k).map(String).filter(Boolean);
const ME = "Austin Stone"; // MVP: single named user until SSO (Phase 2)

/* ───────────── Content ───────────── */
export async function createContent(f: FormData) {
  const jobs = arr(f, "jobs").filter((x) => (JOBS as readonly string[]).includes(x));
  const id = run(`INSERT INTO content_items (title, franchise_id, jobs, platforms, format, subject, publish_at, deadline, owner, campaign_id, month_theme_id, brief, stage)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    s(f, "title") ?? "Untitled", s(f, "franchise_id"), JSON.stringify(jobs), JSON.stringify(arr(f, "platforms")), s(f, "format"), s(f, "subject"),
    s(f, "publish_at"), s(f, "deadline"), s(f, "owner"), s(f, "campaign_id"), s(f, "month_theme_id"), s(f, "brief") ?? "{}", s(f, "stage") ?? "idea").id;
  for (const ref of arr(f, "refs")) { const [t, i] = ref.split(":"); run("INSERT OR IGNORE INTO content_refs (content_item_id, entity_type, entity_id) VALUES (?,?,?)", id, t, Number(i)); }
  run("INSERT INTO stage_events (content_item_id, to_stage, by, note) VALUES (?,?,?, 'created')", id, s(f, "stage") ?? "idea", ME);
  revalidatePath("/content/pipeline");
  redirect(`/content/${id}`);
}

export async function updateContent(f: FormData) {
  const id = Number(s(f, "id"));
  const jobs = arr(f, "jobs").filter((x) => (JOBS as readonly string[]).includes(x));
  const cur = get<ContentItem>("SELECT * FROM content_items WHERE id=?", id)!;
  const brief = { ...j<Record<string, unknown>>(cur.brief, {}) };
  for (const [k, v] of f.entries()) if (k.startsWith("brief.")) brief[k.slice(6)] = String(v);
  const lines = (k: string) => String(s(f, k) ?? "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]);
  if (f.has("lines.links")) brief.links = lines("lines.links").map(([claim, evidence, source]) => ({ claim, evidence: evidence?.toLowerCase().startsWith("doc") ? "documented" : evidence ? "visual_similarity" : undefined, source }));
  if (f.has("lines.beats")) brief.beats = lines("lines.beats").map(([date, text, source]) => ({ date, text, source }));
  if (f.has("has_evidence")) brief.evidence = arr(f, "evidence");
  if (f.has("brief.personId") && !s(f, "brief.personId")) delete brief.personId;
  run(`UPDATE content_items SET title=?, franchise_id=?, jobs=?, platforms=?, format=?, subject=?, publish_at=?, deadline=?, owner=?, editor=?, designer=?, video_editor=?,
       campaign_id=?, month_theme_id=?, caption=?, cta=?, published_url=?, brief=?, updated_at=datetime('now') WHERE id=?`,
    s(f, "title"), s(f, "franchise_id"), JSON.stringify(jobs), JSON.stringify(arr(f, "platforms")), s(f, "format"), s(f, "subject"), s(f, "publish_at"),
    s(f, "deadline"), s(f, "owner"), s(f, "editor"), s(f, "designer"), s(f, "video_editor"), s(f, "campaign_id"), s(f, "month_theme_id"),
    s(f, "caption"), s(f, "cta"), s(f, "published_url"), JSON.stringify(brief), id);
  revalidatePath(`/content/${id}`);
}

export async function moveStage(f: FormData) {
  const id = Number(s(f, "id"));
  const to = s(f, "to")!;
  const override = s(f, "override_reason");
  const item = get<ContentItem>("SELECT * FROM content_items WHERE id=?", id)!;
  const blocks = transitionCheck(item, to).filter((i) => i.level === "block");
  // Only franchise-rule blocks can be overridden (with a reason). Job, rights and CTA gates cannot.
  const overridable = new Set(["min_cleared_works", "no_arc", "entry_count", "too_many_beats", "definition_missing", "no_story"]);
  if (blocks.length) {
    if (override && blocks.every((b) => overridable.has(b.code))) {
      run("UPDATE content_items SET rule_overrides=? WHERE id=?", JSON.stringify([...j<string[]>(item.rule_overrides, []), ...blocks.map((b) => b.code)]), id);
      run("INSERT INTO stage_events (content_item_id, from_stage, to_stage, by, note) VALUES (?,?,?,?,?)", id, item.stage, item.stage, ME, `Rule override: ${blocks.map((b) => b.code).join(", ")} — ${override}`);
    } else {
      redirect(`/content/${id}?blocked=${encodeURIComponent(to)}`);
    }
  }
  tx(() => {
    run("UPDATE content_items SET stage=?, hold_reason=?, updated_at=datetime('now') WHERE id=?", to, to === "on_hold" ? s(f, "hold_reason") : null, id);
    run("INSERT INTO stage_events (content_item_id, from_stage, to_stage, by, note) VALUES (?,?,?,?,?)", id, item.stage, to, ME, s(f, "note"));
    if (to === "approved_to_publish") run("UPDATE content_items SET approval_status='approved' WHERE id=?", id);
    if (to === "changes_requested") run("UPDATE content_items SET approval_status='changes_requested' WHERE id=?", id);
    if (to === "published") writeRunLog(id);
  });
  revalidatePath("/content/pipeline"); revalidatePath(`/content/${id}`);
  if (s(f, "back")) redirect(s(f, "back")!);
}

function writeRunLog(id: number) {
  const item = get<ContentItem>("SELECT * FROM content_items WHERE id=?", id)!;
  const when = new Date().toISOString();
  const platforms = j<string[]>(item.platforms, []);
  const refs = all<{ entity_type: string; entity_id: number }>("SELECT entity_type, entity_id FROM content_refs WHERE content_item_id=?", id);
  const entities = [...refs];
  if (item.franchise_id) entities.push({ entity_type: "franchise", entity_id: item.franchise_id });
  // a used story also logs its issue and credited people
  for (const r of refs.filter((r) => r.entity_type === "issue_item")) {
    const ii = get<{ issue_id: number }>("SELECT issue_id FROM issue_items WHERE id=?", r.entity_id);
    if (ii) entities.push({ entity_type: "issue", entity_id: ii.issue_id });
    for (const p of all<{ person_id: number }>("SELECT DISTINCT person_id FROM credits WHERE target_type='issue_item' AND target_id=?", r.entity_id))
      entities.push({ entity_type: "person", entity_id: p.person_id });
  }
  const seen = new Set<string>();
  for (const e of entities) {
    const key = `${e.entity_type}:${e.entity_id}`; if (seen.has(key)) continue; seen.add(key);
    for (const p of platforms.length ? platforms : [null])
      run("INSERT INTO run_log (content_item_id, platform, published_at, entity_type, entity_id, entity_label, url) VALUES (?,?,?,?,?,?,?)",
        id, p, when, e.entity_type, e.entity_id, entityLabel(e.entity_type, e.entity_id), item.published_url);
  }
}

export async function entityLabelAction(type: string, id: number) { return entityLabel(type, id); }
function entityLabel(type: string, id: number): string {
  const q: Record<string, string> = {
    issue: "SELECT COALESCE('Vol. '||volume||' #'||issue_number, title, 'Issue '||id) l FROM issues WHERE id=?",
    issue_item: "SELECT title l FROM issue_items WHERE id=?", person: "SELECT name l FROM people WHERE id=?",
    artwork: "SELECT COALESCE(title, kind||' #'||id) l FROM artworks WHERE id=?", franchise: "SELECT name l FROM content_franchises WHERE id=?",
    work: "SELECT title l FROM works WHERE id=?", property: "SELECT name l FROM properties WHERE id=?", page: "SELECT 'p.'||page_number l FROM pages WHERE id=?",
    asset: "SELECT COALESCE(title, storage_path) l FROM assets WHERE id=?",
  };
  return (q[type] && get<{ l: string }>(q[type], id)?.l) || `${type} ${id}`;
}

export async function addRef(f: FormData) {
  const id = Number(s(f, "id"));
  const [t, i] = String(s(f, "ref") ?? "").split(":");
  if (t && i) run("INSERT OR IGNORE INTO content_refs (content_item_id, entity_type, entity_id, note) VALUES (?,?,?,?)", id, t, Number(i), s(f, "note"));
  revalidatePath(`/content/${id}`);
}
export async function removeRef(f: FormData) {
  run("DELETE FROM content_refs WHERE id=?", Number(s(f, "ref_id")));
  revalidatePath(`/content/${s(f, "id")}`);
}

export async function reorderFeed(ids: number[]) {
  tx(() => ids.forEach((id, k) => run("UPDATE content_items SET feed_position=? WHERE id=?", k, id)));
  revalidatePath("/content/preview");
}

export async function savePaidVariant(f: FormData) {
  const id = s(f, "variant_id");
  if (id) run("UPDATE paid_variants SET status=?, ad_policy_checked=?, handed_over_at=CASE WHEN ?='live' OR ?='ready' THEN COALESCE(handed_over_at, CASE WHEN ?='1' THEN datetime('now') END) ELSE handed_over_at END WHERE id=?",
    s(f, "status"), s(f, "ad_policy_checked") ? 1 : 0, s(f, "status"), s(f, "status"), s(f, "handed_over"), Number(id));
  else run("INSERT INTO paid_variants (content_item_id, kind, status, month) VALUES (?,?, 'planned', ?)", Number(s(f, "content_item_id")), s(f, "kind"), s(f, "month"));
  revalidatePath("/paid"); revalidatePath(`/content/${s(f, "content_item_id")}`);
}

export async function recommendForPaid(f: FormData) {
  const id = Number(s(f, "content_item_id"));
  const f0 = get<{ paid_outputs: string }>("SELECT f.paid_outputs FROM content_items c JOIN content_franchises f ON f.id=c.franchise_id WHERE c.id=?", id);
  const kinds = j<string[]>(f0?.paid_outputs, ["static"]);
  const month = new Date().toISOString().slice(0, 7);
  for (const k of kinds) if (!get("SELECT 1 FROM paid_variants WHERE content_item_id=? AND kind=?", id, k))
    run("INSERT INTO paid_variants (content_item_id, kind, status, month, notes) VALUES (?,?, 'planned', ?, 'Recommended from organic winners')", id, k, month);
  revalidatePath("/paid");
}

export async function savePerformance(f: FormData) {
  const n = (k: string) => (s(f, k) == null ? null : Number(s(f, k)));
  run(`INSERT INTO performance_snapshots (content_item_id, platform, impressions, reach, views, completion_rate, watch_time, saves, shares, comments, likes, link_clicks, profile_visits, subs_attributed, paid_spend, paid_subs, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'manual')`, Number(s(f, "content_item_id")), s(f, "platform"), n("impressions"), n("reach"), n("views"), n("completion_rate"),
    n("watch_time"), n("saves"), n("shares"), n("comments"), n("likes"), n("link_clicks"), n("profile_visits"), n("subs_attributed"), n("paid_spend"), n("paid_subs"));
  revalidatePath(`/content/${s(f, "content_item_id")}`); revalidatePath("/analytics");
}

export async function saveKpi(f: FormData) {
  run("INSERT INTO kpi_snapshots (date, metric, value) VALUES (?,?,?)", s(f, "date") ?? new Date().toISOString().slice(0, 10), s(f, "metric"), Number(s(f, "value")));
  revalidatePath("/analytics");
}

export async function saveScene(f: FormData) {
  const cid = Number(s(f, "content_item_id"));
  const fields = ["scene", "timecode", "visual", "dialogue", "voiceover", "archive_insert", "overlay", "music", "sound", "edit_direction", "source_asset"];
  const sid = s(f, "scene_id");
  if (sid) run(`UPDATE storyboard_scenes SET ${fields.map((k) => `${k}=?`).join(",")} WHERE id=?`, ...fields.map((k) => s(f, k)), Number(sid));
  else {
    const pos = (get<{ m: number }>("SELECT COALESCE(MAX(position),0)+1 m FROM storyboard_scenes WHERE content_item_id=?", cid)!.m);
    run(`INSERT INTO storyboard_scenes (content_item_id, position, ${fields.join(",")}) VALUES (?,?,${fields.map(() => "?").join(",")})`, cid, pos, ...fields.map((k) => s(f, k)));
  }
  revalidatePath(`/content/${cid}`);
}
export async function moveScene(f: FormData) {
  const id = Number(s(f, "scene_id")); const dir = s(f, "dir") === "up" ? -1 : 1;
  const sc = get<{ content_item_id: number; position: number }>("SELECT content_item_id, position FROM storyboard_scenes WHERE id=?", id)!;
  const other = get<{ id: number; position: number }>(`SELECT id, position FROM storyboard_scenes WHERE content_item_id=? AND position ${dir < 0 ? "<" : ">"} ? ORDER BY position ${dir < 0 ? "DESC" : "ASC"} LIMIT 1`, sc.content_item_id, sc.position);
  if (other) tx(() => { run("UPDATE storyboard_scenes SET position=? WHERE id=?", other.position, id); run("UPDATE storyboard_scenes SET position=? WHERE id=?", sc.position, other.id); });
  revalidatePath(`/content/${sc.content_item_id}`);
}
export async function deleteScene(f: FormData) {
  run("DELETE FROM storyboard_scenes WHERE id=?", Number(s(f, "scene_id")));
  revalidatePath(`/content/${s(f, "content_item_id")}`);
}

/* ───────────── Rights ───────────── */
export async function setRights(f: FormData) {
  const status = s(f, "status") ?? "unknown";
  run(`INSERT INTO rights_records (target_type, target_id, rights_owner, status, usage_types, platform_permissions, restrictions, expires_at, source, requested_at, approver, approved_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?, CASE WHEN ? IN ('requested','pending') THEN datetime('now') END, ?, CASE WHEN ?='cleared' THEN datetime('now') END, datetime('now'))
    ON CONFLICT(target_type, target_id) DO UPDATE SET rights_owner=excluded.rights_owner, status=excluded.status, usage_types=excluded.usage_types,
      platform_permissions=excluded.platform_permissions, restrictions=excluded.restrictions, expires_at=excluded.expires_at, source=excluded.source,
      requested_at=COALESCE(rights_records.requested_at, excluded.requested_at), approver=excluded.approver,
      approved_at=CASE WHEN excluded.status='cleared' THEN COALESCE(rights_records.approved_at, datetime('now')) ELSE NULL END, updated_at=datetime('now')`,
    s(f, "target_type"), Number(s(f, "target_id")), s(f, "rights_owner"), status, JSON.stringify(arr(f, "usage_types").length ? arr(f, "usage_types") : ["organic"]),
    JSON.stringify(arr(f, "platform_permissions")), s(f, "restrictions"), s(f, "expires_at"), s(f, "source"), status, s(f, "approver"), status);
  revalidatePath("/rights");
  if (s(f, "back")) redirect(s(f, "back")!);
}

/** Batch: mark every unknown asset on content publishing in a month as Requested (one batch to Colburn). */
export async function requestRightsBatch(f: FormData) {
  const month = s(f, "month")!;
  const refs = all<{ entity_type: string; entity_id: number }>(`SELECT DISTINCT r.entity_type, r.entity_id FROM content_refs r JOIN content_items c ON c.id=r.content_item_id
    WHERE substr(c.publish_at,1,7)=? AND r.entity_type IN ('artwork','asset','issue_item','issue','page')`, month);
  let n = 0;
  for (const r of refs) {
    const ex = get<{ status: string }>("SELECT status FROM rights_records WHERE target_type=? AND target_id=?", r.entity_type, r.entity_id);
    if (!ex || ex.status === "unknown") { n++;
      run(`INSERT INTO rights_records (target_type, target_id, status, rights_owner, requested_at, source) VALUES (?,?, 'requested', NULL, datetime('now'), ?)
        ON CONFLICT(target_type, target_id) DO UPDATE SET status='requested', requested_at=datetime('now')`, r.entity_type, r.entity_id, `Batch ${month} to Colburn`); }
  }
  revalidatePath("/rights");
  redirect(`/rights?batched=${n}`);
}

/* ───────────── Archive ───────────── */
export async function verifyRecord(f: FormData) {
  const table = s(f, "table")!; const id = Number(s(f, "rid"));
  const conf = s(f, "confidence") ?? "verified";
  if (!["issues", "issue_items", "credits", "artworks", "character_appearances", "people"].includes(table)) throw new Error("bad table");
  const hasVerifiedBy = ["issues", "issue_items", "credits"].includes(table);
  run(`UPDATE ${table} SET confidence=?${hasVerifiedBy ? ", verified_by=?, verified_at=datetime('now')" : ""} WHERE id=?`, ...(hasVerifiedBy ? [conf, conf === "verified" ? ME : null, id] : [conf, id]));
  revalidatePath("/archive/review");
  if (s(f, "back")) redirect(s(f, "back")!);
}

export async function saveIssue(f: FormData) {
  const id = Number(s(f, "id"));
  run("UPDATE issues SET volume=?, issue_number=?, title=?, cover_date=?, publication_date=?, notes=? WHERE id=?",
    s(f, "volume"), s(f, "issue_number"), s(f, "title"), s(f, "cover_date"), s(f, "publication_date"), s(f, "notes"), id);
  reindexIssue(id);
  revalidatePath(`/archive/issues/${id}`);
}

export async function addIssueItem(f: FormData) {
  const issueId = Number(s(f, "issue_id"));
  const itemId = run("INSERT INTO issue_items (issue_id, kind, title, page_start, page_end, synopsis, confidence, provenance) VALUES (?,?,?,?,?,?,?,?)",
    issueId, s(f, "kind") ?? "story", s(f, "title") ?? "Untitled", s(f, "page_start"), s(f, "page_end"), s(f, "synopsis"),
    s(f, "verified") ? "verified" : "likely", JSON.stringify({ method: "manual", by: ME })).id;
  if ((s(f, "kind") ?? "story") === "story") run("UPDATE issue_items SET work_id=? WHERE id=?", run("INSERT INTO works (title) VALUES (?)", s(f, "title")).id, itemId);
  for (const line of String(s(f, "credits") ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [name, role = "artist"] = line.split(/\s*[,|]\s*/);
    const pid = get<{ id: number }>("SELECT id FROM people WHERE name=? COLLATE NOCASE", name)?.id ?? run("INSERT INTO people (name) VALUES (?)", name).id;
    run("INSERT INTO credits (person_id, target_type, target_id, role, confidence, provenance) VALUES (?, 'issue_item', ?, ?, ?, ?)", pid, itemId, role.toLowerCase().replace(" ", "_"),
      s(f, "verified") ? "verified" : "likely", JSON.stringify({ method: "manual", by: ME }));
  }
  reindexIssue(issueId);
  revalidatePath(`/archive/issues/${issueId}`);
}

export async function addArtwork(f: FormData) {
  const issueId = Number(s(f, "issue_id"));
  const page = get<{ id: number; thumbnail_path: string | null }>("SELECT id, thumbnail_path FROM pages WHERE issue_id=? AND page_number=?", issueId, Number(s(f, "page")));
  run("INSERT INTO artworks (title, kind, issue_id, issue_item_id, page_id, notability_note, themes, confidence) VALUES (?,?,?,?,?,?,?, 'likely')",
    s(f, "title"), s(f, "kind") ?? "panel", issueId, s(f, "issue_item_id"), page?.id ?? null, s(f, "note"), JSON.stringify(String(s(f, "themes") ?? "").split(",").map((x) => x.trim()).filter(Boolean)));
  reindexIssue(issueId);
  revalidatePath(`/archive/issues/${issueId}`);
}

/* ───────────── Planning ───────────── */
export async function saveTheme(f: FormData) {
  run(`INSERT INTO month_themes (month, title, reason, primary_stories, campaign_id, paid_opportunities) VALUES (?,?,?,?,?,?)
    ON CONFLICT(month) DO UPDATE SET title=excluded.title, reason=excluded.reason, primary_stories=excluded.primary_stories, campaign_id=excluded.campaign_id, paid_opportunities=excluded.paid_opportunities`,
    s(f, "month"), s(f, "title"), s(f, "reason"), s(f, "primary_stories"), s(f, "campaign_id"), s(f, "paid_opportunities"));
  revalidatePath("/content/calendar");
}

export async function saveCampaign(f: FormData) {
  const id = s(f, "id");
  const vals = [s(f, "name"), s(f, "type"), s(f, "objective"), s(f, "start_date"), s(f, "end_date"), JSON.stringify(arr(f, "jobs")), JSON.stringify(arr(f, "platforms")),
    s(f, "budget") ? Number(s(f, "budget")) : null, s(f, "owner"), s(f, "results")];
  const cid = id ? (run("UPDATE campaigns SET name=?, type=?, objective=?, start_date=?, end_date=?, jobs=?, platforms=?, budget=?, owner=?, results=? WHERE id=?", ...vals, Number(id)), Number(id))
    : run("INSERT INTO campaigns (name, type, objective, start_date, end_date, jobs, platforms, budget, owner, results) VALUES (?,?,?,?,?,?,?,?,?,?)", ...vals).id;
  revalidatePath("/campaigns");
  redirect(`/campaigns/${cid}`);
}
export async function saveDeliverable(f: FormData) {
  const cid = Number(s(f, "campaign_id")); const did = s(f, "deliverable_id");
  if (did) run("UPDATE campaign_deliverables SET done=?, blocker=?, content_item_id=? WHERE id=?", s(f, "done") ? 1 : 0, s(f, "blocker"), s(f, "content_item_id"), Number(did));
  else run("INSERT INTO campaign_deliverables (campaign_id, label, due, content_item_id) VALUES (?,?,?,?)", cid, s(f, "label"), s(f, "due"), s(f, "content_item_id"));
  revalidatePath(`/campaigns/${cid}`);
}

export async function saveReviewRecs(f: FormData) {
  const week = s(f, "week_start")!;
  const recs = j<{ text: string; status: string }[]>(get<{ recommendations: string }>("SELECT recommendations FROM weekly_reviews WHERE week_start=?", week)?.recommendations, []);
  const add = s(f, "add");
  if (add) recs.push({ text: add, status: "open" });
  const idx = s(f, "idx"); if (idx != null) recs[Number(idx)].status = s(f, "status") ?? "open";
  run(`INSERT INTO weekly_reviews (week_start, summary, what_worked, what_didnt, recommendations) VALUES (?,?,?,?,?)
    ON CONFLICT(week_start) DO UPDATE SET summary=COALESCE(excluded.summary, summary), what_worked=COALESCE(excluded.what_worked, what_worked), what_didnt=COALESCE(excluded.what_didnt, what_didnt), recommendations=excluded.recommendations`,
    week, s(f, "summary"), s(f, "what_worked"), s(f, "what_didnt"), JSON.stringify(recs));
  revalidatePath("/analytics/review");
}

/* ───────────── Settings ───────────── */
export async function saveFranchise(f: FormData) {
  const id = Number(s(f, "id"));
  const lines = (k: string) => JSON.stringify(String(s(f, k) ?? "").split("\n").map((x) => x.trim()).filter(Boolean));
  run(`UPDATE content_franchises SET description=?, jobs=?, job_rationale=?, format_spec=?, effort=?, platforms=?, how_we_make_it=?, watch_out=?, example_caption=?,
    research_requirements=?, rights_requirements=?, cta_requirements=?, paid_outputs=?, definition_status=? WHERE id=?`,
    s(f, "description"), JSON.stringify(arr(f, "jobs")), s(f, "job_rationale"), s(f, "format_spec"), s(f, "effort"), lines("platforms"), lines("how_we_make_it"),
    s(f, "watch_out"), s(f, "example_caption"), s(f, "research_requirements"), s(f, "rights_requirements"), s(f, "cta_requirements"),
    JSON.stringify(arr(f, "paid_outputs")), s(f, "description") && s(f, "format_spec") ? "complete" : "partial", id);
  // re-derive frames from the format line, e.g. "F1 the cover full-bleed. F2 ..."
  const spec = s(f, "format_spec") ?? "";
  const frames = [...spec.matchAll(/(F\d+(?:\s*[–-]\s*F\d+)?)\s+([^.]+)\./g)].map((m) => ({ label: m[1], instruction: m[2].trim() }));
  run("UPDATE content_franchises SET frames=? WHERE id=?", JSON.stringify(frames), id);
  revalidatePath("/settings");
}
export async function saveRole(f: FormData) {
  const id = s(f, "id");
  const owns = JSON.stringify(String(s(f, "owns") ?? "").split(",").map((x) => x.trim()).filter(Boolean));
  if (id) run("UPDATE roles SET name=?, owns=?, status=? WHERE id=?", s(f, "name"), owns, s(f, "status"), Number(id));
  else run("INSERT INTO roles (name, owns, status) VALUES (?,?,?)", s(f, "name"), owns, s(f, "status"));
  revalidatePath("/settings");
}
export async function saveUser(f: FormData) {
  run("INSERT INTO users (name, email, role_id) VALUES (?,?,?)", s(f, "name"), s(f, "email"), s(f, "role_id"));
  revalidatePath("/settings");
}
export async function savePlatform(f: FormData) {
  run("UPDATE platforms SET cadence_min=?, cadence_max=?, cadence_period=?, owner_role=? WHERE id=?",
    s(f, "cadence_min"), s(f, "cadence_max"), s(f, "cadence_period"), s(f, "owner_role"), Number(s(f, "id")));
  revalidatePath("/settings");
}
