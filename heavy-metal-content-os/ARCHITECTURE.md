# Heavy Metal Content OS — Architecture

Status: v0.1 (MVP build started 2026-11-09)
Rulebook: the **Heavy Metal Content Hub** in Notion (strategy, four jobs, 19 franchises, platform cadence, ownership, six-week month, organic→paid loop, KPIs). The app encodes that document; it does not invent a new workflow.

---

## Guiding rules (non-negotiable, enforced in code)

1. **Every content item has a Job** (Reach / Explore / Act / Return). A brief cannot move past `Brief` without one. Enforced in the stage-transition validator, not just the UI.
2. **Franchise rules are code, not prose.** Each franchise has a template (data) plus a validator (function). The AI receives the template verbatim and its output is checked by the validator afterwards.
3. **Nothing is silently guessed.** Every archive fact carries a confidence (`verified` / `likely` / `needs_review`). AI extraction can produce `likely` or `needs_review` only. Only a human sets `verified`.
4. **Every claim is typed by source**: `archive`, `internal`, `external`, `inference`. The UI never merges them into one paragraph without labels.
5. **Uncleared rights block production.** Anything not `cleared` cannot reach `Approved to Publish`, and the AI flags it whenever it recommends the asset.
6. **No fake integrations.** If an API credential is missing, the feature shows as *Not connected* with what it would do. Simulated previews are labelled "Simulated".

---

## A. Product architecture

```
Home ─ attention · going live · month tracking · winners · make next · on target
Archive ─ Issues · Artists · Stories · Characters · Franchises(IP) · Artwork · Search · Ingest · Review queue
Create ─ Idea Generator · Carousel Creator · Video Brief · Storyboard · Franchise Selector
Content ─ Pipeline (kanban) · Calendar (month/week/timeline/platform/production) · Social Preview · Run Log
Campaigns ─ list · campaign detail (deliverables x/y, blockers, budget, results)
Rights ─ clearance dashboard · batch request (to Colburn) · expiries
Assets ─ media library linked to entities
Paid ─ organic winners · recommend for paid · variant tracker (x/12)
Analytics ─ organic / paid / shared KPIs · by franchise · by job · Friday review
Heavy Metal AI ─ global assistant (drawer on every page + full page)
Settings ─ roles & ownership · platform cadence · franchises (editable templates) · integrations · users
```

Naming note: "franchise" is overloaded. In this system:
- **Content Franchise** = one of the 19 formats (Artist Spotlight…). Table `content_franchises`.
- **IP / Property** = a story-world from the archive (e.g. a recurring character's series). Table `properties`. Shown in the Archive nav as "Franchises" per the brief, but stored distinctly so the two never collide.

### Key modules

| Module | Purpose | MVP behaviour |
|---|---|---|
| Rules engine (`lib/rules`) | Job requirement, franchise validators, rights gate, six-week schedule, cadence checks, run-log repetition | Pure TS functions, unit-testable, used by API + UI + AI post-check |
| Archive | Connected entities | SQLite + FTS5 search |
| Ingestion | PDF → pages → text → candidate entities | Text + page thumbnails automatic; story/credit extraction via Claude when key present; everything lands in review queue |
| Creator | Franchise-aware generation | Rules pre-check → retrieval → Claude with franchise template → validator post-check → sourced output |
| Pipeline | Stage machine | 12 stages + On Hold / Rejected / Evergreen with gated transitions |
| Calendar | Six-week view + cadence | Computes W-6…W0 milestones per item from publish date |
| Run log | Usage memory | Auto-written on `Published`; queried by idea gen + creator |

---

## B. Database schema

Implementation: `src/lib/db/schema.sql`. Summary of objects and relationships:

### Archive (knowledge foundation)
| Table | Key fields | Relations |
|---|---|---|
| `issues` | id, volume, issue_number, cover_date, publication_date, title, cover_asset_id, cover_artist_id, page_count, source_pdf_asset_id, rights_status, confidence, notes | 1─* pages, 1─* issue_items |
| `pages` | id, issue_id, page_number (physical), printed_page_label, text, thumbnail_path, ocr_method | *─1 issue |
| `issue_items` | id, issue_id, kind (`story`,`interview`,`article`,`advertisement`,`editorial`,`cover`,`pinup`,`letters`), title, page_start, page_end, synopsis, confidence | links to `works` when kind = story |
| `works` (stories) | id, title, original_language, series_property_id, synopsis, themes, genres, keywords | *─* issues via `issue_items` (a story serialised across issues appears once per issue) |
| `people` (creators) | id, name, sort_name, aliases (json), bio, nationality, website | *─* via `credits` |
| `credits` | id, person_id, target_type (`issue_item`,`issue`,`artwork`), target_id, role (`writer`,`artist`,`colorist`,`letterer`,`translator`,`cover_artist`,`interviewee`,`editor`), confidence, source_page_id | join |
| `characters` | id, name, aliases, description, first_appearance_item_id | *─* `character_appearances(character_id, issue_item_id, confidence)` |
| `properties` (IP) | id, name, description | 1─* works, 1─* characters |
| `artworks` | id, title, kind (`cover`,`panel`,`spread`,`pinup`,`rough`,`rejected`,`original`), issue_id, issue_item_id, page_id, asset_id, crop (json bbox), notability_note, themes, confidence | *─1 asset, credits |
| `quotes` | id, text, speaker_person_id, issue_item_id, page_id, confidence | |
| `tags` + `entity_tags` | themes, genres, keywords on any entity | polymorphic |

Every archive row has `confidence` ∈ {verified, likely, needs_review}, `verified_by`, `verified_at`, and `provenance` (json: extraction job id, model, page refs). Search results always resolve back to issue → volume → date → page → asset.

### Assets & rights
| Table | Key fields |
|---|---|
| `assets` | id, kind (`scan`,`artwork`,`cover`,`rough`,`rejected`,`photo`,`video`,`interview`,`product`,`campaign`,`brand`,`social_export`,`pdf`), storage_key, mime, width, height, duration, checksum, linked entity refs |
| `rights_records` | id, asset_id *or* artwork_id *or* issue_item_id, rights_owner, status (`unknown`,`requested`,`pending`,`cleared`,`restricted`,`rejected`), usage_types (json: organic_social, paid, web, merch, print), platform_permissions (json), restrictions, expires_at, source, requested_at, approver, approved_at, batch_id |
| `rights_batches` | id, month_theme_id, sent_to (e.g. Colburn), sent_at, due_at, status |

Effective rights for a content item = the *weakest* status across all its assets, filtered by the item's usage (organic vs paid) and platforms.

### Strategy objects (from the Notion rulebook)
| Table | Key fields |
|---|---|
| `content_franchises` | id, slug, name, tier, description, jobs (json), effort, production_hours, platforms (json), frames/structure (json), aspect_ratio, duration, how_we_make_it (json), research_requirements, required_assets, rights_requirements, cta_requirements, paid_outputs (json), example_caption, watch_out, validator_key |
| `platforms` | id, name, role, cadence_min, cadence_max, cadence_period (`week`,`month`,`drop`), owner_role_id, api_status |
| `roles` | id, name, owns (json list of responsibilities), status (in seat / to hire / outsourced) — editable; users map to roles via `user_roles` |
| `month_themes` | id, month (YYYY-MM), title, reason, primary_story_refs, campaign_id, set_by, status |
| `campaigns` | id, name, type, objective, start/end, jobs, theme_id, platforms, budget, owner, results (json) |
| `campaign_deliverables` | id, campaign_id, label, content_item_id, due, done |

### Content
| Table | Key fields |
|---|---|
| `content_items` | id, title, franchise_id, tier (derived), jobs (json, ≥1 required past Brief), stage, hold_reason, month_theme_id, campaign_id, platforms (json), format (carousel, short video…), owner/editor/designer/video_editor user ids, subject, deadline, publish_at, brief (json), caption, cta, final_asset_id, published_url, approval_status, created_by |
| `content_refs` | content_item_id → issue / issue_item / person / artwork / property / asset (the "what does this use" join; drives rights + run log) |
| `content_frames` | content_item_id, position, role (hook / body / cta), copy, artwork_id, crop, designer_note |
| `content_claims` | content_item_id, text, source_type (`archive`,`internal`,`external`,`inference`), source_ref (page id / doc / URL), confidence |
| `paid_variants` | id, content_item_id, kind (`static`,`cut_6s`,`cut_15s`,`cut_30s`,`vertical`,`alt_hook`), status (`planned`,`in_production`,`ready`,`live`,`retired`), handed_over_at, ad_policy_checked |
| `storyboard_scenes` | content_item_id, position, timecode, visual, dialogue, voiceover, archive_insert, overlay, music, sound, edit_direction, source_asset_id |
| `stage_events` | content_item_id, from, to, by, at, note (audit + "time in stage") |
| `approvals` | content_item_id, approver, decision, notes, at |
| `run_log` | id, content_item_id, platform, published_at, entity_type, entity_id (artwork / issue / work / person / property / franchise), url |
| `performance_snapshots` | content_item_id, platform, captured_at, impressions, reach, views, completion_rate, watch_time, saves, shares, comments, likes, link_clicks, profile_visits, subs_attributed, source (`api`,`manual`,`csv`) |
| `kpi_snapshots` | date, metric (followers, active_subs, email_list, web_sessions, cps, roas, retention_m3…), value, source |
| `weekly_reviews` | week_start, summary (json), what_worked, what_didnt, recommendations (json, each with status `open/acted/dropped` + linked content ids) |
| `notifications` | user/role, kind, entity, message, severity, read_at |
| `ingestion_jobs` | id, asset_id, status, step, log, started/finished |
| `ai_runs` | id, kind, prompt hash, model, input refs, output json, validator result, created_by — every AI output is reproducible/auditable |

---

## C. AI architecture

### Knowledge layers (kept separate so source type is always known)
| Layer | Content | Source type | Index |
|---|---|---|---|
| Archive | page text, issue items, credits, artwork notes, quotes | `archive` | FTS5 per page + per entity (MVP); + vector embeddings per page chunk (Phase 2) |
| Internal | strategy hub, franchise templates, past briefs, run log, performance | `internal` | structured SQL (templates are injected verbatim, not retrieved fuzzily) |
| External | approved web sources fetched for a specific task | `external` | stored per-run with URL + fetched date; never re-used as fact without the URL |
| Inference | model reasoning | `inference` | labelled on output |

### Request flow (e.g. "Artist Spotlight on X")
1. **Franchise resolution** — explicit, or Franchise Selector (Claude classifies into one of 19 with reasons + alternatives; rules engine vetoes impossible picks).
2. **Deterministic pre-check** (no LLM): rules engine queries DB — e.g. Artist Spotlight needs ≥5 *cleared* works by the artist; Cover Story needs a rough/rejected/production asset or documented incident; From the Vault rejects artworks in the run log within 24 months.  Failing → stop with reason + suggested alternative franchise.
3. **Retrieval** — hybrid: FTS5 BM25 over pages/entities (+ vector similarity in Phase 2), filtered by rights and run log; returns *records with IDs*, not prose.
4. **Generation** — Claude (`claude-opus-5-5` for creation, `claude-haiku-5-5` for classification) with: the franchise template verbatim, brand voice rules, retrieved records, and a JSON output schema (tool use / structured output) requiring every claim to cite a record ID or be marked `inference`.
5. **Post-validation** — validator checks structure (frame count, CTA present, word limits), that every cited ID exists, that no citation points to an uncleared asset without a warning, and that `inference` claims are not phrased as fact for influence/date/credit types. Failures are shown, not hidden.
6. **Persist** — `ai_runs` + `content_claims` so the user can inspect every source.

### Assistant (global)
Tool-using agent with read tools over the DB (`search_archive`, `get_issue`, `pipeline_query`, `rights_query`, `run_log_query`, `performance_query`, `calendar_gaps`) and write tools that only create *drafts* (`create_idea`, `create_brief`). No tool can set rights to cleared or archive data to verified.

### Embeddings (Phase 2)
Voyage (`voyage-3` family) or equivalent for text; image embeddings (CLIP-style) for "mechanical imagery" / "cyberpunk city" visual search. Stored in Postgres `pgvector`. MVP uses FTS + Claude re-ranking over candidate pages to approximate natural-language search, and says so in the UI.

---

## D. Archive ingestion architecture

```
Upload PDF ─► asset stored ─► ingestion_job
  1 identify   : filename + cover/indicia page text → volume/issue/date candidates (needs_review until confirmed)
  2 split      : per-page text via pdf.js text layer; if empty → OCR queue (Phase 2: Tesseract / Claude vision)
  3 thumbnails : per-page PNG (pdf.js render; poppler if installed)
  4 contents   : Claude reads table-of-contents + first pages of each story → issue_items with page ranges   [likely/needs_review]
  5 credits    : Claude extracts credit lines *with the page they appear on*; no page → needs_review          [likely/needs_review]
  6 entity link: fuzzy match people/works/properties against existing records → proposed links, never auto-merged
  7 artwork    : Claude vision proposes notable panels/spreads with bbox crops                                 [needs_review]
  8 index      : FTS rows for pages + entities
  9 review     : everything not verified appears in Archive → Review Queue; reviewer confirms against the page image
```
Conflicts (e.g. credit differs from existing record) are stored as both values + `needs_review`, never overwritten.

---

## E. Rights model

- Rights attach at the finest grain available (artwork → asset → issue item → issue). Lookup walks up the chain; the most specific record wins.
- Status set: Unknown → Requested → Pending → Cleared | Restricted | Rejected. Expiry turns Cleared back into Unknown on the date.
- Usage is per channel class: `organic`, `paid`, `web`, `commerce`. Paid needs its own clearance (strategy: "What paid can't touch: anything without rights clearance").
- **Gate:** content cannot enter `Approved`/`Approved to Publish`/`Scheduled` unless every referenced asset is Cleared for that usage and platform. Restricted requires an approver note.
- **W−4 rule:** at publish − 28 days every referenced asset must be at least Requested; at publish − 21 days uncleared assets raise "cut or replace" alerts (strategy: "Uncleared is cut").
- Batch requests: the month's uncleared assets are grouped into one `rights_batch` for Colburn.

---

## F. Content workflow

```
Idea → Research → Brief → Rights/Clearance → Approved → In Production → Editing → Internal Review
     → (Changes Requested ↺) → Approved to Publish → Scheduled → Published        (+ On Hold, Rejected, Evergreen)
```
Transition guards (rules engine):
| Into | Requires |
|---|---|
| Brief → Rights | ≥1 Job, franchise set, franchise pre-check passes (or override with reason) |
| Approved | publish date, owner, platforms, CTA (where franchise requires), rights batch requested |
| Approved to Publish | all rights cleared for use, caption, final asset, approval by calendar owner role, paid variants planned |
| Published | URL (or manual confirmation); writes run log |

Six-week milestones are derived from `publish_at`: W−6 theme set, W−5 locked, W−4 rights cleared, W−3/2 made (+ paid cut-downs), W−1 approved & scheduled & handed to paid, W0 live. Each item gets an expected stage per date; behind = flag ("⚠ Rights clearance overdue — publishes in 18 days").

Mapping to the current Notion statuses (for import): Ideas→Idea, Pending→Brief/Rights, In Progress→In Production, Review→Internal Review, Completed→Published.

---

## G. Integration architecture

Provider interface (`lib/integrations/provider.ts`): `connect()`, `capabilities()`, `schedule()`, `publish()`, `getPost()`, `getInsights()`. Each provider reports capabilities honestly; UI renders from them.

| Platform | API | Notes / constraints |
|---|---|---|
| Instagram | Instagram Graph API (Business/Creator account linked to a Facebook Page, via Meta app) — Content Publishing + Insights | App review needed for `instagram_content_publish`, `instagram_manage_insights`. No native scheduling: we schedule in our job queue and publish at time. Carousel ≤ 10 (now 20) items, Reels supported. |
| Facebook | Pages API | Native scheduled posts supported. |
| TikTok | Content Posting API + Display/Research APIs | Requires app audit before public posting; unaudited apps post private only. Analytics limited. |
| YouTube | Data API v3 (upload, metadata) + Analytics API | OAuth, quota limits (upload ~1,600 units). |
| X | API v2 (paid tier for posting volume) | |
| LinkedIn | Community Management API | Requires approved app. |
| Reddit / Discord | Reddit API / Discord bot | Community, Phase 3 |
| Analytics | Meta Insights, YouTube Analytics, GA4 Data API (web sessions), Shopify (commerce), Klaviyo (email/SMS), subscription platform for subs/retention | Manual CSV import in MVP |
| Storage | Local disk (MVP) → S3/R2 with signed URLs | |
| Auth | MVP: single shared password + named user picker (internal tool on private network). Phase 2: Google Workspace SSO via OAuth/OIDC (Auth.js) | |
| AI | Anthropic Claude API | `ANTHROPIC_API_KEY` required; app runs without it with AI features disabled + labelled |
| Notion | Notion API | Phase 2: two-way sync with the existing Heavy Metal Content database during transition |

MVP ships **no live posting**. The Instagram preview is built from our own data and is labelled "Simulated preview — Instagram not connected".

---

## H. Permissions

Roles are data (`roles` table) — ownership can change without code. Permissions are capability flags attached to roles:

| Capability | Head of Social & Content | Brand & Editorial | Social & Community | Video Editors | Web & Commerce | CRM & Lifecycle | Performance | Rights (Colburn) | Viewer |
|---|---|---|---|---|---|---|---|---|---|
| Edit calendar / schedule | ✔ | – | – | – | – | – | – | – | – |
| Set monthly theme | ✔ | ✔ | – | – | – | – | – | – | – |
| Create / edit content | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | – | – | – |
| Approve to publish | ✔ | – | – | – | – | – | – | – | – |
| Set rights status | – | – | – | – | – | – | – | ✔ | – |
| Verify archive records | ✔ | ✔ | – | – | – | – | – | – | – |
| Paid variants / handover | ✔ | – | – | ✔ | – | – | ✔ | – | – |
| Analytics read | all | all | all | all | all | all | all | – | ✔ |
| Settings / roles | admin flag | | | | | | | | |

---

## I. Scope

### MVP (building now)
1. Archive DB (connected entities, confidence model)
2. PDF ingestion (upload, per-page text, thumbnails, review queue; AI extraction when key present)
3. Archive search (FTS5 keyword + traceable results; NL search via Claude re-rank when key present)
4. 19 franchise templates (from Notion) + programmatic validators
5. Content pipeline (gated stage machine)
6. Monthly calendar + six-week status + cadence/mix warnings
7. Carousel Creator
8. Video Brief generator (+ storyboard table)
9. Rights tracking
10. Run log
11. Campaign tracker
12. AI assistant
13. Instagram feed preview (simulated, drag-to-reorder)
14. Basic analytics (manual/CSV entry, by franchise, by job)

### Phase 2
Postgres + pgvector, image/text embeddings, OCR, SSO, S3 storage, Notion sync, Meta Graph API connection (publish + insights), YouTube, Friday review automation, idea generator using performance history, paid variant workflow automation, notifications by email/Slack.

### Phase 3
TikTok / X / LinkedIn publishing, Reddit/Discord, GA4/Shopify/Klaviyo/subscription KPIs, CAC/ROAS from ad platforms, visual similarity search, connected archive graph explorer, timeline view of an artist's evolution.
