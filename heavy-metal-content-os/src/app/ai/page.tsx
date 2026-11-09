import { aiAvailable, MODEL } from "@/lib/ai/claude";
import { PageHeader } from "@/components/ui";
import { AssistantChat } from "@/components/assistant-chat";

export default function AI() {
  return (
    <div className="max-w-4xl">
      <PageHeader kicker="Heavy Metal AI" title="Ask the archive." sub={`Knows the archive, the 19 franchises, the strategy, the monthly theme, campaigns, pipeline, run log, rights and performance, and looks them up before answering. Every statement is labelled Archive, Internal, External or Inference. Model: ${MODEL}.`} />
      <AssistantChat aiOn={aiAvailable()} />
    </div>
  );
}
