import type Anthropic from "@anthropic-ai/sdk";
import { aiAvailable, client, MODEL, HOUSE_SYSTEM } from "@/lib/ai/claude";
import { TOOLS, runTool } from "@/lib/ai/tools";

const SYSTEM = HOUSE_SYSTEM + `

You are Heavy Metal AI, the assistant inside the content OS. Today is ${new Date().toISOString().slice(0, 10)}.
Use the tools to look things up before answering; never answer archive, pipeline, rights or performance questions from memory.
When you cite archive material give issue + page (e.g. "Heavy Metal Vol. 1 #4, p.12") and label each statement as [Archive], [Internal], [External] or [Inference].
If the archive doesn't contain enough to answer (e.g. few issues ingested yet), say so plainly and say what would need to be uploaded or verified.
When recommending a content franchise, follow its rules from the franchises tool exactly and warn about uncleared rights, recent use (run log) and missing definitions.
Every idea must name its job: Reach, Explore, Act or Return. Keep answers short, in the house voice.`;

export async function POST(req: Request) {
  if (!aiAvailable()) return Response.json({ error: "Heavy Metal AI is not connected (no ANTHROPIC_API_KEY)." }, { status: 503 });
  const body = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
  const messages: Anthropic.Beta.BetaMessageParam[] = body.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }));
  const used: string[] = [];
  try {
    for (let step = 0; step < 10; step++) {
      const res = await client().beta.messages.create({
        model: MODEL, max_tokens: 16000, system: SYSTEM, tools: TOOLS, messages,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      });
      if (res.stop_reason === "refusal") return Response.json({ text: "The model declined this request.", tools: used });
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason !== "tool_use") {
        const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n");
        return Response.json({ text, tools: [...new Set(used)] });
      }
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const b of res.content) {
        if (b.type !== "tool_use") continue;
        used.push(b.name);
        try {
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(runTool(b.name, (b.input ?? {}) as Record<string, unknown>)).slice(0, 60000) });
        } catch (e) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: String((e as Error).message), is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    return Response.json({ text: "Stopped after 10 lookups without a final answer. Try a narrower question.", tools: used });
  } catch (e) {
    return Response.json({ error: `AI request failed: ${(e as Error).message}` }, { status: 500 });
  }
}
