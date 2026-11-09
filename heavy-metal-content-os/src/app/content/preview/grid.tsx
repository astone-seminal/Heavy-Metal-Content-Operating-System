"use client";
import { useState } from "react";
import Link from "next/link";
import { reorderFeed } from "@/app/actions";

export type Post = { id: number; title: string; stage: string; publish_at: string | null; jobs: string[]; caption: string | null; format: string | null; franchise: string | null; campaign: string | null; cover: string | null; frames: { position: number; copy: string }[] };

export function Grid({ posts: initial }: { posts: Post[] }) {
  const [posts, setPosts] = useState(initial);
  const [drag, setDrag] = useState<number | null>(null);
  const [sel, setSel] = useState<Post | null>(null);
  const movable = (p: Post) => p.stage !== "published";

  function drop(target: number) {
    if (drag == null || drag === target) return;
    const next = [...posts];
    const [m] = next.splice(drag, 1);
    next.splice(target, 0, m);
    setPosts(next); setDrag(null);
    void reorderFeed(next.filter(movable).map((p) => p.id));
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,540px)_1fr] gap-8">
      <div className="bg-white/5 p-3">
        <div className="flex items-center gap-3 mb-3"><div className="w-12 h-12 rounded-full bg-hm" /><div><b>heavymetal</b><div className="text-xs text-neutral-500">{posts.length} posts in view</div></div></div>
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((p, i) => (
            <div key={p.id} draggable={movable(p)} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} onClick={() => setSel(p)}
              className={`relative aspect-[4/5] bg-neutral-900 cursor-pointer overflow-hidden ${sel?.id === p.id ? "outline outline-2 outline-hm z-10" : ""} ${movable(p) ? "cursor-grab" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.cover ? <img src={`/api/files/${p.cover}`} alt="" className="w-full h-full object-cover" /> : <div className="p-2 text-[11px] text-neutral-400 leading-tight">{p.title}</div>}
              <div className="absolute top-1 right-1 text-[9px] px-1 bg-black/80 uppercase tracking-wider">{p.format?.includes("video") ? "Reel" : p.frames.length > 1 || p.format === "Carousel" ? "▣" : ""}</div>
              <div className={`absolute bottom-0 left-0 right-0 text-[9px] px-1 py-0.5 uppercase tracking-wider ${p.stage === "published" ? "bg-green-900/80" : p.stage === "scheduled" ? "bg-sky-900/80" : "bg-hm/80"}`}>{p.stage === "published" ? "Published" : p.stage === "scheduled" ? "Scheduled" : "Planned"} {p.publish_at?.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>
      <div>
        {sel ? (
          <div className="card p-5 sticky top-6">
            <div className="kicker">{sel.franchise ?? "No franchise"} · {sel.campaign ?? "Always-on"}</div>
            <div className="display text-3xl mt-1">{sel.title}</div>
            <div className="text-sm text-neutral-400 mt-2">{sel.stage} · {sel.publish_at ?? "no date"} · {sel.jobs.join(", ") || "NO JOB"}</div>
            {sel.frames.length > 0 && <div className="flex gap-2 overflow-x-auto mt-4">{sel.frames.map((f) => <div key={f.position} className="w-40 shrink-0 aspect-[4/5] bg-neutral-900 border border-line p-2 text-[11px]"><b className="text-hm">F{f.position}</b><p className="mt-1">{f.copy}</p></div>)}</div>}
            <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-300 mt-4">{sel.caption ?? "No caption yet."}</pre>
            <Link href={`/content/${sel.id}`} className="btn btn-red mt-4">Open</Link>
          </div>
        ) : <p className="text-neutral-500 text-sm">Click a post to see its frames, caption, franchise, job, campaign and status.</p>}
      </div>
    </div>
  );
}
