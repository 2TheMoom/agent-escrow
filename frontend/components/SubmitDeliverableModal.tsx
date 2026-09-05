"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSubmitDeliverable } from "@/lib/hooks/useAgentEscrow";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import type { Task } from "@/lib/contracts/types";

interface SubmitDeliverableModalProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitDeliverableModal({ task, open, onOpenChange }: SubmitDeliverableModalProps) {
  const { submitDeliverable, isSubmitting, isSuccess, pendingTxHash, clearPendingTx } = useSubmitDeliverable();

  const [reportedValue, setReportedValue] = useState("");
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setReportedValue("");
    setFormError("");
    clearPendingTx();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) resetForm();
    onOpenChange(nextOpen);
  };

  useEffect(() => {
    if (isSuccess) {
      resetForm();
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportedValue.trim()) {
      setFormError("Enter the value you found at the source");
      return;
    }
    submitDeliverable({ taskId: task.id, reportedValue: reportedValue.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="ledger-card border sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold font-[family-name:var(--font-display)]">
            File a Declaration
          </DialogTitle>
          <DialogDescription>
            Declare what you found at {task.source_url} for: {task.fact_description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reportedValue" className="eyebrow">Declared Value</label>
            <input
              id="reportedValue"
              type="text"
              placeholder="e.g. 3421.50"
              value={reportedValue}
              onChange={(e) => { setReportedValue(e.target.value); setFormError(""); }}
              className={`font-mono text-sm bg-transparent border-0 border-b outline-none py-1.5 ${formError ? "border-destructive" : "border-dotted border-muted-foreground focus:border-primary"}`}
            />
            <p className="text-xs text-muted-foreground">
              Validators will independently re-fetch the source and compare - declare the
              actual value, not a guess. This can only be filed once.
            </p>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>

          <div className="space-y-3 pt-1">
            {isSubmitting && (
              <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
                {pendingTxHash ? (
                  <>
                    <span>Declaration filed - awaiting confirmation...</span>
                    <a href={getTxExplorerUrl(pendingTxHash)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary hover:underline">
                      View on explorer
                    </a>
                  </>
                ) : (
                  <span>Filing declaration...</span>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Filing...</>) : "File Declaration"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
