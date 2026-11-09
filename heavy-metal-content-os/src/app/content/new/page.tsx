import { all } from "@/lib/db";
import { JOBS, FORMATS } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { createContent } from "@/app/actions";

export default async function NewContent({ searchParams }: PageProps<"/content/new">) {
  const sp = await searchParams;
  const franchises = all<{ id: number; name: string; tier: number; slug: string }>("SELECT id, name, tier, slug FROM content_franchises ORDER BY tier, id");
  const platforms = all<{ key: string; name: string }>("SELECT key, name FROM platforms");
  const pre = franchises.find((f) => f.slug === sp.franchise);
  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Content" title="New piece" sub="Pick the job before you make the thing. If it doesn't do one of the four jobs, we don't make it." />
      <form action={createContent} className="card p-5 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2"><label className="label">Working title</label><input name="title" required className="input" defaultValue={String(sp.title ?? "")} /></div>
        <div><label className="label">Content franchise</label><select name="franchise_id" defaultValue={pre?.id ?? ""} className="select"><option value="">Decide later</option>{franchises.map((f) => <option key={f.id} value={f.id}>T{f.tier} · {f.name}</option>)}</select></div>
        <div><label className="label">Format</label><select name="format" className="select"><option value="">—</option>{FORMATS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="md:col-span-2"><label className="label">Job</label><div className="flex gap-4">{JOBS.map((j) => <label key={j} className="flex gap-2 text-sm items-center"><input type="checkbox" name="jobs" value={j} />{j}</label>)}</div></div>
        <div className="md:col-span-2"><label className="label">Platforms</label><div className="flex flex-wrap gap-3">{platforms.map((p) => <label key={p.key} className="flex gap-1.5 text-sm items-center"><input type="checkbox" name="platforms" value={p.key} defaultChecked={p.key === "instagram"} />{p.name}</label>)}</div></div>
        <div><label className="label">Publish date</label><input type="date" name="publish_at" className="input" /></div>
        <div><label className="label">Owner</label><input name="owner" className="input" defaultValue="Austin Stone" /></div>
        <div className="md:col-span-2 text-right"><button className="btn btn-red">Create</button></div>
      </form>
    </div>
  );
}
