import { all } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";

export default function Properties() {
  const rows = all<{ id: number; name: string; description: string | null; works: number; characters: number }>(`
    SELECT p.*, (SELECT COUNT(*) FROM works w WHERE w.property_id=p.id) works, (SELECT COUNT(*) FROM characters c WHERE c.property_id=p.id) characters FROM properties p ORDER BY name`);
  return (
    <div>
      <PageHeader kicker="Archive" title="Franchises (IP)" sub="Story-worlds that run across issues. Not to be confused with the 19 content franchises (formats), which live in Create and Settings." />
      {rows.length ? <table className="table"><thead><tr><th>Name</th><th>Stories</th><th>Characters</th><th>Description</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td className="font-semibold">{r.name}</td><td>{r.works}</td><td>{r.characters}</td><td className="text-neutral-400">{r.description}</td></tr>)}</tbody></table>
        : <Empty title="No IP records yet">These are linked during review once stories are verified. Phase 2 adds AI-proposed groupings.</Empty>}
    </div>
  );
}
