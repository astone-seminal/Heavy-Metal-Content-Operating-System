import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get, j } from "@/lib/db";
import { issueLabel } from "@/lib/archive/search";
import { rightsFor, lastUsed } from "@/lib/rules";
import { PageHeader, Conf, Rights, Section, Thumb, Empty } from "@/components/ui";
import { saveIssue, verifyRecord, addIssueItem, addArtwork } from "@/app/actions";
import { ISSUE_ITEM_KINDS } from "@/lib/constants";

type Item = { id: number; kind: string; title: string; page_start: number | null; page_end: number | null; synopsis: string | null; confidence: string; provenance: string | null };

export default async function IssuePage({ params, searchParams }: PageProps<"/archive/issues/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const issue = get<Record<string, string | number | null>>("SELECT * FROM issues WHERE id=?", Number(id));
  if (!issue) notFound();
  const iid = Number(id);
  const pages = all<{ id: number; page_number: number; thumbnail_path: string | null; text: string | null; text_method: string }>("SELECT id, page_number, thumbnail_path, text, text_method FROM pages WHERE issue_id=? ORDER BY page_number", iid);
  const items = all<Item>("SELECT * FROM issue_items WHERE issue_id=? ORDER BY page_start, id", iid);
  const credits = all<{ id: number; target_id: number; name: string; person_id: number; role: string; confidence: string; provenance: string | null }>(
    "SELECT c.id, c.target_id, p.name, p.id person_id, c.role, c.confidence, c.provenance FROM credits c JOIN people p ON p.id=c.person_id WHERE c.target_type='issue_item' AND c.target_id IN (SELECT id FROM issue_items WHERE issue_id=?)", iid);
  const arts = all<{ id: number; title: string | null; kind: string; page_number: number | null; thumbnail_path: string | null; notability_note: string | null; confidence: string }>(
    "SELECT a.id, a.title, a.kind, p.page_number, p.thumbnail_path, a.notability_note, a.confidence FROM artworks a LEFT JOIN pages p ON p.id=a.page_id WHERE a.issue_id=?", iid);
  const sel = Number(sp.page ?? 0) || null;
  const selPage = sel ? pages.find((p) => p.page_number === sel) : null;
  const pdf = issue.source_pdf_asset_id ? get<{ storage_path: string }>("SELECT storage_path FROM assets WHERE id=?", issue.source_pdf_asset_id) : null;
  const cover = issue.cover_asset_id ? get<{ storage_path: string }>("SELECT storage_path FROM assets WHERE id=?", issue.cover_asset_id) : null;
  const back = `/archive/issues/${iid}`;
  const used = lastUsed("issue", iid);

  return (
    <div>
      <PageHeader kicker="Issue" title={issueLabel(issue as never)} sub={<span className="flex gap-2 items-center flex-wrap"><Conf c={String(issue.confidence)} /> <Rights s={rightsFor("issue", iid).status} /> {issue.page_count} pages {used ? `· last used ${used.published_at.slice(0, 10)} on ${used.platform}` : "· never published"}</span>}>
        {pdf && <a href={`/api/files/${pdf.storage_path}`} target="_blank" className="btn">Source PDF</a>}
        <Link href={`/rights?type=issue&id=${iid}`} className="btn">Rights</Link>
      </PageHeader>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8 mb-10">
        <Thumb path={cover?.storage_path} alt="Cover" className="w-full aspect-[3/4]" />
        <form action={saveIssue} className="grid grid-cols-2 gap-3 content-start">
          <input type="hidden" name="id" value={iid} />
          {(["volume", "issue_number", "cover_date", "publication_date", "title"] as const).map((k) => (
            <div key={k}><label className="label">{k.replace("_", " ")}</label><input className="input" name={k} defaultValue={String(issue[k] ?? "")} placeholder={k === "publication_date" ? "YYYY-MM-DD" : k === "cover_date" ? "As printed" : ""} /></div>
          ))}
          <div className="col-span-2"><label className="label">Notes</label><textarea className="textarea" rows={2} name="notes" defaultValue={String(issue.notes ?? "")} /></div>
          <div className="col-span-2 flex gap-2">
            <button className="btn">Save</button>
          </div>
        </form>
      </div>
      <form action={verifyRecord} className="-mt-6 mb-10 flex gap-2 items-center text-sm text-neutral-400">
        <input type="hidden" name="table" value="issues" /><input type="hidden" name="rid" value={iid} /><input type="hidden" name="back" value={back} />
        Issue identity checked against the printed cover / indicia?
        <button name="confidence" value="verified" className="btn">Mark verified</button>
        <button name="confidence" value="needs_review" className="btn">Needs review</button>
      </form>

      <Section title="Contents">
        {items.length ? (
          <table className="table">
            <thead><tr><th>Pages</th><th>Kind</th><th>Title</th><th>Credits</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => {
                const prov = j<{ uncertain?: string; method?: string }>(it.provenance, {});
                return (
                  <tr key={it.id}>
                    <td className="whitespace-nowrap"><Link className="link" href={`${back}?page=${it.page_start}`}>{it.page_start ?? "?"}–{it.page_end ?? "?"}</Link></td>
                    <td className="text-neutral-400">{it.kind}</td>
                    <td><b>{it.title}</b>{it.synopsis && <div className="text-xs text-neutral-500">{it.synopsis}</div>}{prov.uncertain && <div className="text-xs text-amber-300 mt-1">⚠ {prov.uncertain}</div>}</td>
                    <td className="text-xs">{credits.filter((c) => c.target_id === it.id).map((c) => (
                      <div key={c.id} className="flex gap-1 items-center mb-1">
                        <Link href={`/archive/artists/${c.person_id}`} className="link">{c.name}</Link> <span className="text-neutral-500">{c.role}</span> <Conf c={c.confidence} />
                        {c.confidence !== "verified" && <form action={verifyRecord}><input type="hidden" name="table" value="credits" /><input type="hidden" name="rid" value={c.id} /><input type="hidden" name="back" value={back} /><button className="text-[10px] underline text-neutral-400">verify</button></form>}
                      </div>))}</td>
                    <td><Conf c={it.confidence} /> <span className="text-[10px] text-neutral-600 block mt-1">{prov.method ?? ""}</span></td>
                    <td>{it.confidence !== "verified" && <form action={verifyRecord}><input type="hidden" name="table" value="issue_items" /><input type="hidden" name="rid" value={it.id} /><input type="hidden" name="back" value={back} /><button className="btn">Verify</button></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty title="No contents yet">AI extraction runs on upload when Heavy Metal AI is connected. You can also add items by hand below.</Empty>}
        <details className="mt-4 card p-4">
          <summary className="cursor-pointer kicker">Add a contents item by hand</summary>
          <form action={addIssueItem} className="grid md:grid-cols-6 gap-3 mt-4">
            <input type="hidden" name="issue_id" value={iid} />
            <div><label className="label">Kind</label><select name="kind" className="select">{ISSUE_ITEM_KINDS.map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="md:col-span-3"><label className="label">Title (as printed)</label><input name="title" className="input" required /></div>
            <div><label className="label">Page start</label><input name="page_start" type="number" className="input" /></div>
            <div><label className="label">Page end</label><input name="page_end" type="number" className="input" /></div>
            <div className="md:col-span-3"><label className="label">Credits: one per line “Name, role”</label><textarea name="credits" rows={3} className="textarea" placeholder={"Name, writer\nName, artist"} /></div>
            <div className="md:col-span-3"><label className="label">Synopsis</label><textarea name="synopsis" rows={3} className="textarea" /></div>
            <label className="md:col-span-4 text-sm flex items-center gap-2"><input type="checkbox" name="verified" /> I checked this against the printed issue (mark Verified)</label>
            <div className="md:col-span-2 text-right"><button className="btn btn-red">Add</button></div>
          </form>
        </details>
      </Section>

      <Section title="Notable artwork">
        {arts.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {arts.map((a) => (
              <div key={a.id}>
                <Link href={`${back}?page=${a.page_number}`}><Thumb path={a.thumbnail_path} alt="" className="w-full aspect-[3/4]" /></Link>
                <div className="text-xs mt-1">{a.title ?? a.kind} · p.{a.page_number} <Conf c={a.confidence} /></div>
                {a.notability_note && <div className="text-[11px] text-neutral-500">{a.notability_note}</div>}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-neutral-500">No artwork records yet.</p>}
        <details className="mt-4 card p-4">
          <summary className="cursor-pointer kicker">Add artwork record</summary>
          <form action={addArtwork} className="grid md:grid-cols-6 gap-3 mt-4">
            <input type="hidden" name="issue_id" value={iid} />
            <div><label className="label">Page</label><input name="page" type="number" className="input" required /></div>
            <div><label className="label">Kind</label><select name="kind" className="select">{["cover", "panel", "spread", "pinup", "rough", "rejected", "original"].map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="md:col-span-2"><label className="label">Title</label><input name="title" className="input" /></div>
            <div className="md:col-span-2"><label className="label">Story</label><select name="issue_item_id" className="select"><option value="">—</option>{items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></div>
            <div className="md:col-span-3"><label className="label">Why it matters</label><input name="note" className="input" /></div>
            <div className="md:col-span-2"><label className="label">Themes (comma separated)</label><input name="themes" className="input" /></div>
            <div className="text-right self-end"><button className="btn btn-red">Add</button></div>
          </form>
        </details>
      </Section>

      <Section title="Pages">
        {selPage && (
          <div className="grid md:grid-cols-[320px_1fr] gap-6 mb-6 card p-4">
            <Thumb path={selPage.thumbnail_path} alt="" className="w-full" />
            <div>
              <div className="kicker mb-2">Page {selPage.page_number} · text: {selPage.text_method}</div>
              <pre className="whitespace-pre-wrap text-sm text-neutral-300 max-h-[480px] overflow-auto font-sans">{selPage.text || "No text layer on this page. OCR is Phase 2."}</pre>
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-2">
          {pages.map((p) => (
            <Link key={p.id} href={`${back}?page=${p.page_number}`} className={`block ${sel === p.page_number ? "outline outline-2 outline-hm" : ""}`}>
              <Thumb path={p.thumbnail_path} alt="" className="w-full aspect-[3/4]" />
              <div className="text-[10px] text-center text-neutral-500">{p.page_number}</div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
