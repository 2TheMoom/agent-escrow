"use client";

import { useState } from "react";
import { Loader2, FileClock } from "lucide-react";
import { formatEther } from "viem";
import { useTasks, useAdjudicate, useCancelTask, useAgentEscrowContract } from "@/lib/hooks/useAgentEscrow";
import { useWallet } from "@/lib/genlayer/wallet";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";
import { error } from "@/lib/utils/toast";
import { AddressDisplay } from "./AddressDisplay";
import { SubmitDeliverableModal } from "./SubmitDeliverableModal";
import { Button } from "./ui/button";
import type { Task } from "@/lib/contracts/types";

function manifestNumber(id: string): string {
  return /^\d+$/.test(id) ? `№${id.padStart(4, "0")}` : `№${id}`;
}

function portOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function TasksTable() {
  const contract = useAgentEscrowContract();
  const { data: tasks, isLoading, isError } = useTasks();
  const { address, isConnected, isLoading: isWalletLoading } = useWallet();
  const { adjudicate, isAdjudicating, adjudicatingTaskId, pendingTxHash: adjudicateTxHash } = useAdjudicate();
  const { cancelTask, isCancelling, cancellingTaskId, pendingTxHash: cancelTxHash } = useCancelTask();

  const handleAdjudicate = (taskId: string) => {
    if (!address) {
      error("Please connect your wallet to inspect a manifest");
      return;
    }
    adjudicate(taskId);
  };

  const handleCancel = (taskId: string) => {
    if (!address) {
      error("Please connect your wallet to withdraw a bond");
      return;
    }
    cancelTask(taskId);
  };

  if (isLoading) {
    return (
      <div className="ledger-card p-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="eyebrow">Opening the register...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="ledger-card p-10 text-center">
        <h3 className="text-lg font-bold">Setup Required</h3>
        <p className="text-muted-foreground mt-2 text-sm">
          Set <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your .env file.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ledger-card p-10 text-center">
        <p className="text-destructive text-sm">Failed to open the register. Please try again.</p>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="ledger-card p-12 text-center space-y-2">
        <FileClock className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
        <h3 className="text-lg font-bold">The Register Is Empty</h3>
        <p className="text-muted-foreground text-sm">File the first manifest above.</p>
      </div>
    );
  }

  return (
    <div>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          currentAddress={address}
          isConnected={isConnected}
          isWalletLoading={isWalletLoading}
          onAdjudicate={handleAdjudicate}
          onCancel={handleCancel}
          isAdjudicating={isAdjudicating && adjudicatingTaskId === task.id}
          adjudicatePendingTxHash={adjudicatingTaskId === task.id ? adjudicateTxHash : null}
          isCancelling={isCancelling && cancellingTaskId === task.id}
          cancelPendingTxHash={cancellingTaskId === task.id ? cancelTxHash : null}
        />
      ))}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  currentAddress: string | null;
  isConnected: boolean;
  isWalletLoading: boolean;
  onAdjudicate: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  isAdjudicating: boolean;
  adjudicatePendingTxHash: string | null;
  isCancelling: boolean;
  cancelPendingTxHash: string | null;
}

function TaskRow({
  task, currentAddress, isConnected, isWalletLoading, onAdjudicate, onCancel,
  isAdjudicating, adjudicatePendingTxHash, isCancelling, cancelPendingTxHash,
}: TaskRowProps) {
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const isRequester = currentAddress?.toLowerCase() === task.requester?.toLowerCase();
  const isWorker = currentAddress?.toLowerCase() === task.worker?.toLowerCase();
  const canSubmit = isConnected && isWorker && !isWalletLoading && task.status === "open";
  const canCancel = isConnected && isRequester && !isWalletLoading && task.status === "open";
  const canAdjudicate = isConnected && !isWalletLoading && task.status === "submitted";
  const isFinal = task.status === "accepted" || task.status === "rejected" || task.status === "cancelled";

  let amountDisplay = "0";
  try {
    amountDisplay = formatEther(BigInt(task.amount));
  } catch {
    amountDisplay = task.amount;
  }

  return (
    <div className="manifest-row relative grid grid-cols-[44px_1fr] sm:grid-cols-[64px_1fr_auto] gap-4 sm:gap-5 items-start py-5 border-b border-border/70 last:border-b-0 animate-fade-in">
      <div className="hidden sm:flex flex-col items-center gap-1.5 pt-0.5">
        <span className="font-mono text-xs text-muted-foreground">{manifestNumber(task.id)}</span>
        <span className="w-px flex-1 min-h-[28px] perf-line" />
      </div>
      <span className="sm:hidden font-mono text-xs text-muted-foreground">{manifestNumber(task.id)}</span>

      <div className="min-w-0">
        <h3 className="text-base font-bold font-[family-name:var(--font-display)]">{task.fact_description}</h3>
        <div className="mt-1.5 font-mono text-xs text-muted-foreground leading-relaxed break-all">
          PORT <span className="text-foreground">{portOf(task.source_url)}</span>
          {" · "}FILED BY <span className="text-foreground"><AddressDisplay address={task.requester} maxLength={10} /></span>
          {" · "}ASSIGNED TO <span className="text-foreground"><AddressDisplay address={task.worker} maxLength={10} /></span>
        </div>

        {task.status === "submitted" && (
          <div className="mt-2.5 pl-3 border-l-2 border-border font-mono text-xs text-muted-foreground max-w-[60ch]">
            <span className="block eyebrow mb-0.5">Declared Value</span>
            {task.reported_value}
          </div>
        )}

        {(task.status === "accepted" || task.status === "rejected") && (
          <div className="mt-2.5 pl-3 border-l-2 border-border font-mono text-xs text-muted-foreground max-w-[60ch] space-y-1">
            <div><span className="eyebrow mr-1">Declared Value</span>{task.reported_value}</div>
            <div><span className="eyebrow mr-1 block">Validator Note</span>&ldquo;{task.verdict_reasoning}&rdquo;</div>
          </div>
        )}

        {isAdjudicating && (
          <div className="mt-2.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {adjudicatePendingTxHash ? (
              <>
                <span>Inspection filed - awaiting validator confirmation...</span>
                <a href={getTxExplorerUrl(adjudicatePendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary hover:underline">
                  View on explorer
                </a>
              </>
            ) : (
              <span>Filing inspection...</span>
            )}
          </div>
        )}

        {isCancelling && (
          <div className="mt-2.5 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {cancelPendingTxHash ? (
              <>
                <span>Withdrawal filed - awaiting confirmation...</span>
                <a href={getTxExplorerUrl(cancelPendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary hover:underline">
                  View on explorer
                </a>
              </>
            ) : (
              <span>Filing withdrawal...</span>
            )}
          </div>
        )}
      </div>

      <div className={`col-span-2 sm:col-span-1 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:min-w-[150px] ${isFinal ? "" : "sm:pt-0.5"}`}>
        <div className="font-mono text-sm tabular">
          {amountDisplay} <span className="text-muted-foreground text-xs">GEN</span>
        </div>

        {task.status === "open" && (
          <span className="font-mono text-[0.68rem] tracking-wider uppercase flex items-center gap-1.5" style={{ color: "var(--amber)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--amber)" }} />
            Awaiting Declaration
          </span>
        )}
        {task.status === "submitted" && (
          <span className="font-mono text-[0.68rem] tracking-wider uppercase flex items-center gap-1.5" style={{ color: "var(--steel)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--steel)" }} />
            Awaiting Inspection
          </span>
        )}
        {task.status === "accepted" && <span className="ink-stamp text-sm px-3 py-1" style={{ color: "var(--primary)" }}>Cleared</span>}
        {task.status === "rejected" && <span className="ink-stamp text-sm px-3 py-1" style={{ color: "var(--rust)" }}>Held</span>}
        {task.status === "cancelled" && <span className="ink-stamp text-sm px-3 py-1 opacity-60" style={{ color: "var(--void)", transform: "rotate(-4deg)" }}>Withdrawn</span>}

        {canSubmit && (
          <Button onClick={() => setIsSubmitOpen(true)} size="sm" variant="gradient">
            File Declaration
          </Button>
        )}
        {canCancel && (
          <Button onClick={() => onCancel(task.id)} disabled={isCancelling} size="sm" variant="outline">
            {isCancelling ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" />Withdrawing...</>) : "Withdraw Bond"}
          </Button>
        )}
        {canAdjudicate && (
          <Button onClick={() => onAdjudicate(task.id)} disabled={isAdjudicating} size="sm" variant="gradient">
            {isAdjudicating ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" />Inspecting...</>) : "Inspect & Clear"}
          </Button>
        )}
      </div>

      {canSubmit && <SubmitDeliverableModal task={task} open={isSubmitOpen} onOpenChange={setIsSubmitOpen} />}
    </div>
  );
}
