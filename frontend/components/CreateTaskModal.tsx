"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Wallet, Link as LinkIcon, FileText, Coins } from "lucide-react";
import { parseEther } from "viem";
import { useCreateTask } from "@/lib/hooks/useAgentEscrow";
import type { FeePresetLevel } from "@/lib/genlayer/fees";
import { useWallet } from "@/lib/genlayer/wallet";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";
import { ALLOWED_SOURCE_DOMAINS } from "@/lib/contracts/types";
import { error } from "@/lib/utils/toast";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function isAllowedSource(url: string): boolean {
  const lower = url.toLowerCase();
  return ALLOWED_SOURCE_DOMAINS.some((domain) => lower.includes(domain));
}

export function CreateTaskModal() {
  const { isConnected, address, isLoading } = useWallet();
  const { createTask, isCreating, isSuccess, pendingTxHash, clearPendingTx } = useCreateTask();

  const [isOpen, setIsOpen] = useState(false);
  const [worker, setWorker] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [factDescription, setFactDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [feePresetLevel, setFeePresetLevel] = useState<FeePresetLevel>("standard");

  const [errors, setErrors] = useState({ worker: "", sourceUrl: "", factDescription: "", amount: "" });

  useEffect(() => {
    if (!isConnected && isOpen && !isCreating) setIsOpen(false);
  }, [isConnected, isOpen, isCreating]);

  const validateForm = (): boolean => {
    const newErrors = { worker: "", sourceUrl: "", factDescription: "", amount: "" };

    if (!worker.trim()) {
      newErrors.worker = "Worker address is required";
    } else if (!/^0x[0-9a-fA-F]{40}$/.test(worker.trim())) {
      newErrors.worker = "Must be a valid 0x... address";
    }

    if (!sourceUrl.trim()) {
      newErrors.sourceUrl = "A source URL is required";
    } else if (!isAllowedSource(sourceUrl.trim())) {
      newErrors.sourceUrl = `Must be from an approved source: ${ALLOWED_SOURCE_DOMAINS.join(", ")}`;
    }

    if (!factDescription.trim()) {
      newErrors.factDescription = "Describe the fact you need reported";
    }

    if (!amount.trim() || Number(amount) <= 0) {
      newErrors.amount = "Enter a positive GEN amount to escrow";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((e) => e !== "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      error("Please connect your wallet first");
      return;
    }
    if (!validateForm()) return;

    let amountWei: bigint;
    try {
      amountWei = parseEther(amount.trim());
    } catch {
      setErrors({ ...errors, amount: "Invalid amount" });
      return;
    }

    createTask({ worker: worker.trim(), sourceUrl: sourceUrl.trim(), factDescription: factDescription.trim(), amountWei, feePresetLevel });
  };

  const resetForm = () => {
    setWorker("");
    setSourceUrl("");
    setFactDescription("");
    setAmount("");
    setErrors({ worker: "", sourceUrl: "", factDescription: "", amount: "" });
    clearPendingTx();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isCreating) resetForm();
    setIsOpen(open);
  };

  useEffect(() => {
    if (isSuccess) {
      resetForm();
      setIsOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="gradient" disabled={!isConnected || !address || isLoading}>
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">New Task</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="brand-card border-2 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create a Data-Delivery Task</DialogTitle>
          <DialogDescription>
            Escrow payment for another agent to fetch and report a fact from an
            approved source. Validators independently re-check it before releasing funds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="worker" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Worker Address
            </Label>
            <Input
              id="worker"
              type="text"
              placeholder="0x... (the agent who will complete this task)"
              value={worker}
              onChange={(e) => { setWorker(e.target.value); setErrors({ ...errors, worker: "" }); }}
              className={errors.worker ? "border-destructive" : ""}
            />
            {errors.worker && <p className="text-xs text-destructive">{errors.worker}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl" className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Source URL
            </Label>
            <Input
              id="sourceUrl"
              type="text"
              placeholder="https://api.coingecko.com/..."
              value={sourceUrl}
              onChange={(e) => { setSourceUrl(e.target.value); setErrors({ ...errors, sourceUrl: "" }); }}
              className={errors.sourceUrl ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Must be one of: {ALLOWED_SOURCE_DOMAINS.join(", ")} - a neutral source neither of you controls.
            </p>
            {errors.sourceUrl && <p className="text-xs text-destructive">{errors.sourceUrl}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="factDescription" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Fact to Report
            </Label>
            <textarea
              id="factDescription"
              placeholder="e.g. the current ETH/USD price"
              value={factDescription}
              onChange={(e) => { setFactDescription(e.target.value); setErrors({ ...errors, factDescription: "" }); }}
              rows={2}
              className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                errors.factDescription ? "border-destructive" : "border-white/10"
              }`}
            />
            {errors.factDescription && <p className="text-xs text-destructive">{errors.factDescription}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Escrow Amount (GEN)
            </Label>
            <Input
              id="amount"
              type="text"
              placeholder="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors({ ...errors, amount: "" }); }}
              className={errors.amount ? "border-destructive" : ""}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="space-y-3">
            <Label>Network Fee Tier</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "low", label: "Low", detail: "No extra rounds" },
                { value: "standard", label: "Standard", detail: "+1 dispute round" },
                { value: "high", label: "High", detail: "+2 dispute rounds" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeePresetLevel(option.value)}
                  className={`rounded-md border px-3 py-2 text-left transition-all ${
                    feePresetLevel === option.value ? "border-accent bg-accent/20 text-accent" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="text-sm font-semibold">{option.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{option.detail}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            {isCreating && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                {pendingTxHash ? (
                  <>
                    <span>Transaction submitted - waiting for confirmation...</span>
                    <a href={getTxExplorerUrl(pendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-accent hover:underline">
                      View on explorer
                    </a>
                  </>
                ) : (
                  <span>Preparing transaction...</span>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient" className="flex-1" disabled={isCreating}>
                {isCreating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>) : "Create Task"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
