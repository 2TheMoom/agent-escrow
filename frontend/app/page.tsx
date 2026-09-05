"use client";

import { formatEther } from "viem";
import { Navbar } from "@/components/Navbar";
import { FileManifestDrawer } from "@/components/FileManifestDrawer";
import { TasksTable } from "@/components/TasksTable";
import { useTasks } from "@/lib/hooks/useAgentEscrow";

function TallyStrip() {
  const { data: tasks } = useTasks();
  const list = tasks ?? [];

  const filed = list.length;
  const cleared = list.filter((t) => t.status === "accepted").length;
  const held = list.filter((t) => t.status === "rejected").length;

  let bonded = 0n;
  for (const t of list) {
    if (t.status === "open" || t.status === "submitted") {
      try {
        bonded += BigInt(t.amount);
      } catch {
        // skip unparsable amounts
      }
    }
  }

  const items = [
    { label: "Manifests Filed", value: filed.toString() },
    { label: "Cleared", value: cleared.toString(), color: "var(--primary)" },
    { label: "Held", value: held.toString(), color: "var(--rust)" },
    { label: "Currently Bonded", value: `${formatEther(bonded)} GEN` },
  ];

  return (
    <div className="flex flex-wrap divide-x divide-border">
      {items.map((item, i) => (
        <div key={item.label} className={`flex flex-col gap-0.5 pr-6 ${i > 0 ? "pl-6" : ""}`}>
          <span className="font-mono text-base font-medium tabular" style={item.color ? { color: item.color } : undefined}>
            {item.value}
          </span>
          <span className="eyebrow">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-16">
        <div className="max-w-4xl mx-auto px-5 md:px-7">
          <div className="py-4 border-b border-border">
            <TallyStrip />
          </div>

          <section className="py-8">
            <FileManifestDrawer />
          </section>

          <section className="pb-16">
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5 mb-1">
              <h2 className="text-base font-bold font-[family-name:var(--font-display)]">The Register</h2>
              <span className="eyebrow">Every manifest, in order filed</span>
            </div>
            <TasksTable />
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-5">
        <div className="max-w-4xl mx-auto px-5 md:px-7 flex items-center justify-between flex-wrap gap-3 font-mono text-xs text-muted-foreground">
          <span>GenLayer Bradbury Testnet</span>
          <div className="flex items-center gap-5">
            <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              GenLayer
            </a>
            <a href="https://portal.genlayer.foundation/agent-tank" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              Agent Tank
            </a>
            <a href="https://docs.genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              Docs
            </a>
            <a href="https://github.com/2TheMoom/agent-escrow" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
