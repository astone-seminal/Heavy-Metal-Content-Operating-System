import { startIngestion } from "@/lib/archive/ingest";

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No PDF uploaded" }, { status: 400 });
  const results = [];
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".pdf")) { results.push({ name: f.name, error: "Not a PDF" }); continue; }
    results.push({ name: f.name, ...(await startIngestion(f)) });
  }
  return Response.json({ results });
}
