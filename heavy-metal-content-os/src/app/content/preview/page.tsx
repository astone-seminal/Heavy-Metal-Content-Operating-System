import { all, get, j } from "@/lib/db";
import { PageHeader, NotConnected } from "@/components/ui";
import { Grid, type Post } from "./grid";

function coverFor(id: number): string | null {
  const ref = get<{ entity_type: string; entity_id: number }>("SELECT entity_type, entity_id FROM content_refs WHERE content_item_id=? AND entity_type IN ('artwork','page','issue','issue_item') ORDER BY CASE entity_type WHEN 'artwork' THEN 0 WHEN 'page' THEN 1 WHEN 'issue_item' THEN 2 ELSE 3 END LIMIT 1", id);
  if (!ref) return null;
  const q: Record<string, string> = {
    artwork: "SELECT p.thumbnail_path t FROM artworks a JOIN pages p ON p.id=a.page_id WHERE a.id=?",
    page: "SELECT thumbnail_path t FROM pages WHERE id=?",
    issue_item: "SELECT p.thumbnail_path t FROM issue_items i JOIN pages p ON p.issue_id=i.issue_id AND p.page_number=i.page_start WHERE i.id=?",
    issue: "SELECT a.storage_path t FROM issues s JOIN assets a ON a.id=s.cover_asset_id WHERE s.id=?",
  };
  return get<{ t: string }>(q[ref.entity_type], ref.entity_id)?.t ?? null;
}

export default function Preview() {
  const rows = all<{ id: number; title: string; stage: string; publish_at: string | null; jobs: string; caption: string | null; format: string | null; franchise: string | null; campaign: string | null; feed_position: number | null }>(`
    SELECT c.id, c.title, c.stage, c.publish_at, c.jobs, c.caption, c.format, f.name franchise, k.name campaign, c.feed_position
    FROM content_items c LEFT JOIN content_franchises f ON f.id=c.franchise_id LEFT JOIN campaigns k ON k.id=c.campaign_id
    WHERE c.platforms LIKE '%"instagram"%' AND c.stage NOT IN ('rejected','on_hold')
    ORDER BY CASE WHEN c.stage='published' THEN 1 ELSE 0 END, c.feed_position IS NULL, c.feed_position, c.publish_at DESC`);
  const posts: Post[] = rows.map((r) => ({ ...r, jobs: j<string[]>(r.jobs, []), cover: coverFor(r.id),
    frames: all<{ position: number; copy: string }>("SELECT position, copy FROM content_frames WHERE content_item_id=? ORDER BY position", r.id) }));
  return (
    <div>
      <PageHeader kicker="Content" title="Instagram preview" sub="Planned, scheduled and published posts as a grid. Drag planned posts to try a different order; the order is saved here, not on Instagram." />
      <div className="mb-6"><NotConnected what="Simulated preview: Instagram is not connected.">Published posts here are the ones marked Published in this system, not pulled from the account. Connecting the Meta Graph API (Phase 2) will add the live grid, real Reel covers and post URLs.</NotConnected></div>
      <Grid posts={posts} />
    </div>
  );
}
