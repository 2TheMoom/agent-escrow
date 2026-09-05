"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { parseEther } from "viem";
import { useCreateTask } from "@/lib/hooks/useAgentEscrow";
import type { FeePresetLevel } from "@/lib/genlayer/fees";
import { useWallet } from "@/lib/genlayer/wallet";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";
import { ALLOWED_SOURCE_DOMAINS } from "@/lib/contracts/types";
import { error } from "@/lib/utils/toast";
import { Button } from "./ui/button";

const PORTS: { domain: string; defaultUrl: string }[] = [
  { domain: "api.coingecko.com", defaultUrl: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd" },
  { domain: "api.coinbase.com", defaultUrl: "https://api.coinbase.com/v2/prices/ETH-USD/spot" },
  { domain: "etherscan.io", defaultUrl: "https://etherscan.io/" },
];

function isAllowedSource(url: string): boolean {
  const lower = url.toLowerCase();
  return ALLOWED_SOURCE_DOMAINS.some((domain) => lower.includes(domain));
}

export function FileManifestDrawer() {
  const { isConnected, address, isLoading } = useWallet();
  const { createTask, isCreating, isSuccess, pendingTxHash, clearPendingTx } = useCreateTask();

  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPort, setSelectedPort] = useState(0);
  const [worker, setWorker] = useState("");
  const [sourceUrl, setSourceUrl] = useState(PORTS[0].defaultUrl);
  const [factDescription, setFactDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [feePresetLevel, setFeePresetLevel] = useState<FeePresetLevel>("standard");

  const [errors, setErrors] = useState({ worker: "", sourceUrl: "", factDescription: "", amount: "" });

  const selectPort = (index: number) => {
    setSelectedPort(index);
    setSourceUrl(PORTS[index].defaultUrl);
    setErrors((e) => ({ ...e, sourceUrl: "" }));
  };

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
      newErrors.sourceUrl = `Must be from an authorized port: ${ALLOWED_SOURCE_DOMAINS.join(", ")}`;
    }

    if (!factDescription.trim()) {
      newErrors.factDescription = "Describe the fact you need declared";
    }

    if (!amount.trim() || Number(amount) <= 0) {
      newErrors.amount = "Enter a positive GEN amount to bond";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((e) => e !== "");
  };

  const resetForm = () => {
    setWorker("");
    setSelectedPort(0);
    setSourceUrl(PORTS[0].defaultUrl);
    setFactDescription("");
    setAmount("");
    setErrors({ worker: "", sourceUrl: "", factDescription: "", amount: "" });
    clearPendingTx();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !address) {
      error("Connect your wallet before filing a manifest");
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

  useEffect(() => {
    if (isSuccess) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  return (
    <div className="ledger-card p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">File a New Manifest</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-[58ch] leading-relaxed">
            Escrow a bond for another agent to fetch and declare a fact from an authorized
            port. Validators inspect the declaration against the source before your bond
            is released.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="font-mono text-xs text-muted-foreground border border-border rounded px-2.5 py-1.5 hover:border-primary/50 hover:text-primary transition-colors whitespace-nowrap shrink-0"
        >
          {isExpanded ? "− Collapse" : "+ File a Manifest"}
        </button>
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="worker" className="eyebrow">Worker Agent</label>
            <input
              id="worker"
              type="text"
              placeholder="0x..."
              value={worker}
              onChange={(e) => { setWorker(e.target.value); setErrors({ ...errors, worker: "" }); }}
              className={`font-mono text-sm bg-transparent border-0 border-b outline-none py-1.5 ${errors.worker ? "border-destructive" : "border-dotted border-muted-foreground focus:border-primary"}`}
            />
            {errors.worker && <p className="text-xs text-destructive">{errors.worker}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="amount" className="eyebrow">Bond Amount (GEN)</label>
            <input
              id="amount"
              type="text"
              placeholder="0.01"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors({ ...errors, amount: "" }); }}
              className={`font-mono text-sm bg-transparent border-0 border-b outline-none py-1.5 ${errors.amount ? "border-destructive" : "border-dotted border-muted-foreground focus:border-primary"}`}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2">
            <span className="eyebrow">Port of Entry</span>
            <div className="flex flex-wrap gap-2">
              {PORTS.map((port, i) => (
                <button
                  key={port.domain}
                  type="button"
                  onClick={() => selectPort(i)}
                  className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${
                    selectedPort === i
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "border-border text-muted-foreground bg-muted/40 hover:border-primary/50"
                  }`}
                >
                  {port.domain}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={sourceUrl}
              onChange={(e) => { setSourceUrl(e.target.value); setErrors({ ...errors, sourceUrl: "" }); }}
              className={`mt-1 font-mono text-xs bg-transparent border-0 border-b outline-none py-1.5 ${errors.sourceUrl ? "border-destructive" : "border-dotted border-muted-foreground focus:border-primary"}`}
            />
            {errors.sourceUrl && <p className="text-xs text-destructive">{errors.sourceUrl}</p>}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="factDescription" className="eyebrow">Declared Fact</label>
            <input
              id="factDescription"
              type="text"
              placeholder="e.g. ETH / USD spot price"
              value={factDescription}
              onChange={(e) => { setFactDescription(e.target.value); setErrors({ ...errors, factDescription: "" }); }}
              className={`font-[family-name:var(--font-display)] text-base bg-transparent border-0 border-b outline-none py-1.5 ${errors.factDescription ? "border-destructive" : "border-dotted border-muted-foreground focus:border-primary"}`}
            />
            {errors.factDescription && <p className="text-xs text-destructive">{errors.factDescription}</p>}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-2">
            <span className="eyebrow">Network Fee Tier</span>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "low", label: "Low", detail: "No extra rounds" },
                { value: "standard", label: "Standard", detail: "+1 dispute round" },
                { value: "high", label: "High", detail: "+2 dispute rounds" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeePresetLevel(option.value)}
                  className={`font-mono text-xs px-3 py-1.5 rounded border text-left transition-colors ${
                    feePresetLevel === option.value
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground bg-muted/40 hover:border-primary/50"
                  }`}
                >
                  {option.label} <span className="opacity-70">· {option.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 flex flex-col gap-3 pt-2 border-t border-border">
            {isCreating && (
              <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
                {pendingTxHash ? (
                  <>
                    <span>Manifest filed - awaiting confirmation...</span>
                    <a href={getTxExplorerUrl(pendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary hover:underline">
                      View on explorer
                    </a>
                  </>
                ) : (
                  <span>Filing manifest...</span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">
                {isConnected ? "Bond refunds automatically if withdrawn before a declaration is filed." : "Connect your wallet to file a manifest."}
              </span>
              <Button type="submit" variant="gradient" disabled={isCreating || !isConnected || !address || isLoading}>
                {isCreating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Filing...</>) : "File & Escrow Bond →"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
