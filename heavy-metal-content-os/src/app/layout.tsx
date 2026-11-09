import type { Metadata } from "next";
import { Anton, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { AssistantDrawer } from "@/components/assistant-drawer";
import { aiAvailable } from "@/lib/ai/claude";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Heavy Metal — Content OS",
  description: "Archive, content production, rights and publishing for Heavy Metal.",
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex">
        <Nav aiOn={aiAvailable()} />
        <main className="flex-1 min-w-0 px-6 md:px-10 py-8 pb-24">{children}</main>
        <AssistantDrawer aiOn={aiAvailable()} />
      </body>
    </html>
  );
}
