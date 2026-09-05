"use client";

import { useState, useEffect } from "react";
import { FileCheck, Loader2 } from "lucide-react";
import { useSubmitDeliverable } from "@/lib/hooks/useAgentEscrow";
import { getTxExplorerUrl } from "@/lib/genlayer/chains";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
      <DialogContent className="brand-card border-2 sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-accent" />
            Submit Deliverable
          </DialogTitle>
          <DialogDescription>
            Report what you found at {task.source_url} for: {task.fact_description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="reportedValue">Reported Value</Label>
            <Input
              id="reportedValue"
              type="text"
              placeholder="e.g. 3421.50"
              value={reportedValue}
              onChange={(e) => { setReportedValue(e.target.value); setFormError(""); }}
              className={formError ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Validators will independently re-fetch the source and compare - report the
              actual value, not a guess. This can only be submitted once.
            </p>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>

          <div className="space-y-2 pt-2">
            {isSubmitting && (
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
              <Button type="button" variant="secondary" className="flex-1" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>) : "Submit"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
