import Link from "next/link";
import { all, get } from "@/lib/db";
import { searchArchive, issueLabel } from "@/lib/archive/search";
import { nlToQuery } from "@/lib/archive/nl";
import { aiAvailable } from "@/lib/ai/claude";
import { PageHeader, Empty, Thumb, Conf } from "@/components/ui";

export default async function ArchiveSearch({ searchParams }: PageProps<"/archive">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const mode = String(sp.mode ?? "keyword");
  const stats = get<{ issues: number; pages: number; items: number; verified: number }>(
    "SELECT (SELECT COUNT(*) FROM issues) issues, (SELECT COUNT(*) FROM pages) pages, (SELECT COUNT(*) FROM issue_items) items, (SELECT COUNT(*) FROM issue_items WHERE confidence='verified') verified")!;
  let interp: Awaited<ReturnType<typeof nlToQuery>> | null = null;
  let error: string | null = null;
  let hits: ReturnType<typeof searchArchive> = [];
  if (q) {
    if (mode === "ask" && aiAvailable()) {
      try { interp = await nlToQuery(q); hits = searchArchive(q, { fts: interp.fts, types: interp.types, dateFrom: interp.date_from ?? undefined, dateTo: interp.date_to ?? undefined, limit: 60 }); }
      catch (e) { error = (e as Error).message; }
    } else hits = searchArchive(q);
  }
  const covers = all<{ id: number; volume: string; issue_number: string; cover_date: string; title: string; thumbnail_path: string | null }>(
    "SELECT s.id, s.volume, s.issue_number, s.cover_date, s.title, a.storage_path thumbnail_path FROM issues s LEFT JOIN assets a ON a.id=s.cover_asset_id ORDER BY s.publication_date DESC, s.id DESC LIMIT 12");

  return (
    <div>
      <PageHeader kicker="The archive" title="Fifty years. Every page."
        sub={`${stats.issues} issues · ${stats.pages} pages · ${stats.items} contents records (${stats.verified} verified). Every result links back to issue, page and source.`}>
        <Link href="/archive/ingest" className="btn btn-red">Upload issues</Link>
      </PageHeader>

      <form className="mb-8">
        <div className="flex gap-2">
          <input name="q" defaultValue={q} className="input text-lg! py-3!" placeholder={mode === "ask" ? "Show me covers from the early 1980s involving mechanical imagery" : "Moebius, RanXerox, cyberpunk city…"} autoFocus />
          <button className="btn btn-red px-6!">Search</button>
        </div>
        <div className="flex gap-4 mt-3 text-sm text-neutral-400">
          <label className="flex items-center gap-2"><input type="radio" name="mode" value="keyword" defaultChecked={mode !== "ask"} /> Keyword</label>
          <label className={`flex items-center gap-2 ${aiAvailable() ? "" : "opacity-40"}`}><input type="radio" name="mode" value="ask" defaultChecked={mode === "ask"} disabled={!aiAvailable()} /> Natural language {aiAvailable() ? "" : "(AI not connected)"}</label>
        </div>
      </form>

      {interp && (
        <div className="card p-4 mb-6 text-sm">
          <div className="kicker mb-1">How this was read <span className="chip ml-2 border-dashed border-purple-500 text-purple-400">AI inference</span></div>
          <div className="text-neutral-300">{interp.explanation}</div>
          <div className="text-neutral-500 mt-1 font-mono text-xs">terms: {interp.fts} {interp.date_from ? `· from ${interp.date_from}` : ""} {interp.date_to ? `· to ${interp.date_to}` : ""}</div>
          {interp.limits && <div className="text-amber-300/80 mt-2">{interp.limits}</div>}
        </div>
      )}
      {error && <div className="text-hm mb-4 text-sm">{error}</div>}

      {q ? (
        hits.length ? (
          <div className="space-y-2">
            <div className="kicker mb-2">{hits.length} results</div>
            {hits.map((h) => <Hit key={`${h.entity_type}${h.entity_id}`} h={h} />)}
          </div>
        ) : <Empty title="Nothing found">{stats.issues ? "Try fewer or different words." : "The archive is empty. Upload issue PDFs to start."}</Empty>
      ) : covers.length ? (
        <div>
          <div className="kicker mb-3">Recently added issues</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {covers.map((c) => (
              <Link key={c.id} href={`/archive/issues/${c.id}`} className="group">
                <Thumb path={c.thumbnail_path} alt="" className="w-full aspect-[3/4] group-hover:opacity-80" />
                <div className="text-xs mt-2 text-neutral-300">{issueLabel(c)}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Empty title="The archive is empty">Upload Heavy Metal PDFs in <Link className="link" href="/archive/ingest">Ingest</Link>. Each one is split into pages, made searchable, and its contents and credits queued for review.</Empty>
      )}
    </div>
  );
}

function Hit({ h }: { h: ReturnType<typeof searchArchive>[number] }) {
  const href = h.entity_type === "issue" ? `/archive/issues/${h.entity_id}` : `/archive/issues/${h.issue_id}${h.page_number ? `?page=${h.page_number}` : ""}`;
  const conf = h.entity_type === "issue_item" ? get<{ confidence: string }>("SELECT confidence FROM issue_items WHERE id=?", h.entity_id)?.confidence : null;
  const thumb = h.issue_id && h.page_number ? get<{ thumbnail_path: string }>("SELECT thumbnail_path FROM pages WHERE issue_id=? AND page_number=?", h.issue_id, h.page_number)?.thumbnail_path : null;
  const parts = h.snippet.split(/\[\[|\]\]/);
  return (
    <Link href={href} className="card p-3 flex gap-4 hover:border-neutral-500">
      <Thumb path={thumb} alt="" className="w-14 h-20 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip text-neutral-400">{h.entity_type.replace("_", " ")}</span>
          <b className="text-white">{h.title}</b>
          {conf && <Conf c={conf} />}
        </div>
        <div className="text-sm text-neutral-400 mt-1">{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}</div>
        <div className="text-xs text-neutral-500 mt-1">{h.issue_label}{h.page_number ? ` · page ${h.page_number}` : ""}{h.publication_date ? ` · ${h.publication_date}` : ""}</div>
      </div>
    </Link>
  );
}
