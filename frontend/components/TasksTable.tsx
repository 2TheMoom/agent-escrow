"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, FileClock, Ban, Scale } from "lucide-react";
import { formatEther } from "viem";
import { useTasks, useAdjudicate, useCancelTask, useAgentEscrowContract } from "@/lib/hooks/useAgentEscrow";
import { useWallet } from "@/lib/genlayer/wallet";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";
import { error } from "@/lib/utils/toast";
import { AddressDisplay } from "./AddressDisplay";
import { SubmitDeliverableModal } from "./SubmitDeliverableModal";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import type { Task } from "@/lib/contracts/types";

export function TasksTable() {
  const contract = useAgentEscrowContract();
  const { data: tasks, isLoading, isError } = useTasks();
  const { address, isConnected, isLoading: isWalletLoading } = useWallet();
  const { adjudicate, isAdjudicating, adjudicatingTaskId, pendingTxHash: adjudicateTxHash } = useAdjudicate();
  const { cancelTask, isCancelling, cancellingTaskId, pendingTxHash: cancelTxHash } = useCancelTask();

  const handleAdjudicate = (taskId: string) => {
    if (!address) {
      error("Please connect your wallet to adjudicate a task");
      return;
    }
    adjudicate(taskId);
  };

  const handleCancel = (taskId: string) => {
    if (!address) {
      error("Please connect your wallet to cancel a task");
      return;
    }
    cancelTask(taskId);
  };

  if (isLoading) {
    return (
      <div className="brand-card p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="brand-card p-12 text-center">
        <h3 className="text-xl font-bold">Setup Required</h3>
        <p className="text-muted-foreground mt-2">
          Set <code className="bg-muted px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your .env file.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="brand-card p-8 text-center">
        <p className="text-destructive">Failed to load tasks. Please try again.</p>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="brand-card p-12 text-center space-y-3">
        <FileClock className="w-16 h-16 mx-auto text-muted-foreground opacity-30" />
        <h3 className="text-xl font-bold">No Tasks Yet</h3>
        <p className="text-muted-foreground">Be the first to create a data-delivery task!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

function StatusBadge({ status }: { status: Task["status"] }) {
  switch (status) {
    case "accepted":
      return <Badge className="bg-green-500/15 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    case "submitted":
      return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Submitted</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground border-white/20"><Ban className="w-3 h-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline" className="text-blue-400 border-blue-500/30"><FileClock className="w-3 h-3 mr-1" />Open</Badge>;
  }
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

  let amountDisplay = "0";
  try {
    amountDisplay = formatEther(BigInt(task.amount));
  } catch {
    amountDisplay = task.amount;
  }

  return (
    <div className="brand-card brand-card-hover p-4 sm:p-5 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{task.fact_description}</span>
            <StatusBadge status={task.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span>Requester: <AddressDisplay address={task.requester} maxLength={10} /></span>
            <span>Worker: <AddressDisplay address={task.worker} maxLength={10} /></span>
            <span className="font-semibold text-accent">{amountDisplay} GEN</span>
          </div>
          <a href={task.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline break-all">
            {task.source_url}
          </a>
        </div>

        <div className="flex gap-2 shrink-0">
          {canSubmit && (
            <Button onClick={() => setIsSubmitOpen(true)} size="sm" variant="gradient">
              Submit Deliverable
            </Button>
          )}
          {canCancel && (
            <Button onClick={() => onCancel(task.id)} disabled={isCancelling} size="sm" variant="outline">
              {isCancelling ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" />Cancelling...</>) : "Cancel"}
            </Button>
          )}
          {canAdjudicate && (
            <Button onClick={() => onAdjudicate(task.id)} disabled={isAdjudicating} size="sm" variant="gradient">
              {isAdjudicating ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" />Adjudicating...</>) : (<><Scale className="w-3.5 h-3.5 mr-1" />Adjudicate</>)}
            </Button>
          )}
        </div>
      </div>

      {task.status === "submitted" && (
        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground">
          Reported value: <span className="font-mono text-foreground">{task.reported_value}</span>
        </div>
      )}

      {(task.status === "accepted" || task.status === "rejected") && (
        <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground space-y-1">
          <div>Reported value: <span className="font-mono text-foreground">{task.reported_value}</span></div>
          <div>{task.verdict_reasoning}</div>
        </div>
      )}

      {isAdjudicating && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {adjudicatePendingTxHash ? (
            <>
              <span>Transaction submitted - waiting for validator confirmation...</span>
              <a href={getTxExplorerUrl(adjudicatePendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-accent hover:underline">
                View on explorer
              </a>
            </>
          ) : (
            <span>Preparing transaction...</span>
          )}
        </div>
      )}

      {isCancelling && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {cancelPendingTxHash ? (
            <>
              <span>Transaction submitted - waiting for confirmation...</span>
              <a href={getTxExplorerUrl(cancelPendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-accent hover:underline">
                View on explorer
              </a>
            </>
          ) : (
            <span>Preparing transaction...</span>
          )}
        </div>
      )}

      {canSubmit && <SubmitDeliverableModal task={task} open={isSubmitOpen} onOpenChange={setIsSubmitOpen} />}
    </div>
  );
}
