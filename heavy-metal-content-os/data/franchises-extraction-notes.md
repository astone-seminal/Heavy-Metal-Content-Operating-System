# Franchise extraction notes

Extracted from Notion on 2026-11-09. Nothing in Notion was modified.

## Sources checked

- **Heavy Metal Content Hub** (401e85f3-fa39-8142-9ef8-e6a5c5cf5144): the source for the 19-franchise list, the tier groupings ("Editorial carousels / Short video / Documentary"), and the four Jobs (Reach, Explore, Act, Return). Every entry lists it in `sourcePages` because it sets the tier. It has no per-franchise definitions.
- **Content templates** (401e85f3-fa39-8158-9850-d7a717fa7260): has templates for Cover Story and Artist Spotlight. The others (New Content, Interview, News, Social post) are not franchises.
- **Content Calander** data source (collection://14ce85f3-…), Brand = Heavy Metal: 61 rows. Only 8 franchises have a full definition section (Job / Format / Effort / Platforms / How we make it / Watch out).
- **Heavy Metal Content** database (collection://7f76fb52-…): 0 rows. It lists all 19 franchises as `Content Type` options, but the options have no descriptions.
- **Seminal Content System** (14ce85f3-fa39-80f6-…) and **Heavy Metal 50** (401e85f3-fa39-8179-…): no franchise or format reference section. Seminal Content System has a "FORMAT KEY", which is only the emoji legend for media types.
- **Heavy Metal** brand overview (14de85f3-fa39-80dd-…): names some franchises in passing, but has no definitions.
- **Example captions:** none found for any franchise. The only "Caption" field is an empty placeholder in the generic "Social post" template. `exampleCaption` is null for all 19.

## Per franchise

| Franchise | Tier | Status | Source page |
|---|---|---|---|
| Artist Spotlight | 1 | PARTIAL | Content templates (401e85f3fa3981589850d7a717fa7260). Has only: Job = Explore (property, no rationale), Platform = Instagram, Website, and the template checklist. No description, format, effort or watch-out. The "Artist Spotlight" pages under Content Writing / Content System / Projects Pipeline belong to Seminal Artist Group, not Heavy Metal, so they were NOT used. |
| From the Vault | 1 | FULL | From the Vault: 13 Jan (402e85f3-fa39-8141-897a-e93b6dc5031a). Not campaign. Verbatim. |
| Cover Story | 1 | FULL | 50 After: Cover Stories begin (401e85f3-fa39-81ee-a1da-e8014df71bc8), Campaign HM50. |
| Essential Reading | 1 | FULL | Essential Reading: 10 Jan (402e85f3-fa39-8131-9b28-e6153612d3e7). Not campaign. Verbatim. The 17/24/31 Jan pages are the same template. |
| Issue Guide | 1 | FULL | Issue Guide: 8 Jan (402e85f3-fa39-8126-91be-d0a840d4dd9d). Not campaign. Verbatim. |
| Heavy Reading | 1 | NOT FOUND | Only the name appears in the Hub tier table. |
| Chain of Influence | 1 | NOT FOUND | Only the name appears in the Hub, the brand overview, and an Artist Spotlight checklist item. |
| History Of | 1 | NOT FOUND | Only the name appears in the Hub. |
| Product Details | 1 | NOT FOUND | Only the name appears in the Hub, plus a passing mention on the Collection Lookbook page ("Product Details and the drop ads use these images"). |
| This or That | 2 | NOT FOUND | Only the name appears in the Hub. "Cover of the 50: knockout rounds" (HM50) says "This or That posts on TikTok" but gives no definition. |
| Studio Visit | 2 | FULL | Studio Visit film: first artist (401e85f3-fa39-8100-8277-d7d6b351f1a0), Campaign HM50. |
| Behind the Drop | 2 | FULL | Capsule: Behind the Drop (401e85f3-fa39-8174-8d23-c6fe6e23086f), Campaign HM50. |
| Artist Capsule | 2 | NOT FOUND | Only the name appears in the Hub. |
| HMM Lives Here | 3 | NOT FOUND | Only the name appears in the Hub. |
| Collector Files | 3 | NOT FOUND | Only the name appears in the Hub. |
| Community Stories | 3 | NOT FOUND | Only the name appears in the Hub. |
| Heavily Influenced | 3 | FULL | Heavily Influenced episode (401e85f3-fa39-81d8-a2c3-cad35d490db7), Campaign HM50. |
| Collection Film | 3 | NOT FOUND | Only the name appears in the Hub. |
| Collection Lookbook | 3 | FULL | Capsule: Collection Lookbook (401e85f3-fa39-8145-a98e-dedcb48f17cf), Campaign HM50. |

For NOT FOUND franchises, every content field is null or []. Only name, slug, tier and the Hub source are filled.

## Campaign (HM50) detail removed from the rules

Only campaign-specific words were deleted. No wording was added.

- **Cover Story:** dropped the description's second sentence, "The HM50 covers qualify because every artist supplies process material in their kit." Dropped the HM50 "Brief" section (19 April start, two or three a week). The checklist heading said "(per artist)", which was dropped. The item "Asset kit received: Q&A, process photos, roughs, timelapse, portrait" is kept verbatim. The "asset kit" is an HM50 concept, so review whether it applies outside the campaign.
- **Behind the Drop:** "the anniversary capsule" became "the capsule". The job rationale "Runs in the two weeks before the 16 August drop" became "…before the drop". "Lock the edit five weeks out (by 12 July)" dropped "(by 12 July)". The HM50 "Timing" section was excluded.
- **Studio Visit:** "one HM50 artist’s workspace" became "one artist’s workspace". The "This film" block (artist from the HM50 roster, shoot date) was excluded.
- **Heavily Influenced:** "An HM50 artist walks through … that formed them, tying the 50 After back to the archive." became "An artist walks through … that formed them." The campaign clause was removed and nothing replaces it. The "This episode" block (Book by 10 May, 7 June release) was excluded.
- **Collection Lookbook:** "the anniversary capsule" became "the capsule". The "Timing" section (9 August, a week before the drop) was excluded.
- Per-week "This week’s pick" blocks on non-campaign pages were excluded because they are instance placeholders, not rules.

## Field conventions and conflicts

- `platforms` keeps Notion's annotations verbatim, e.g. "Instagram (primary)", "Instagram (clips)", "YouTube Shorts".
- `jobs` is parsed from the first sentence of the Job line. `jobRationale` is the full text after "Job:".
- `aspectRatio` is the primary ratio from the Format line. Secondary ratios ("with vertical cutdowns", "with 16:9 crops") stay only in `formatSpec`.
- `durationSpec` is set only where Format gives a running time. Carousels are null, and their frame count stays in `formatSpec`.
- `frames` is parsed only where the Format line lists F-numbered frames (the 4 carousels with a definition).
- **Conflict, Cover Story jobs:** the calendar page says "Reach + Explore". The Content templates page sets the property "Job = Explore". The JSON uses the calendar definition (Reach, Explore).
- **Cover Story template:** the Content templates page also has a different 3-slide structure ("What you’re looking at / How it was made… / Why it still matters") and rights checks ("High-res scan located", "Cleared by Colburn", "Ad-policy check"). These were NOT merged into the JSON, which uses the 5–7 frame calendar definition. Reconcile manually if needed.
