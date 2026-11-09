import { get } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/ingest/[id]">) {
  const { id } = await ctx.params;
  const job = get("SELECT id, issue_id, status, step, log FROM ingestion_jobs WHERE id=?", Number(id));
  return job ? Response.json(job) : Response.json({ error: "Not found" }, { status: 404 });
}
