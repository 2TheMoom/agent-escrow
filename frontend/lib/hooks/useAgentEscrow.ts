"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import AgentEscrow from "../contracts/AgentEscrow";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import type { FeePresetLevel } from "../genlayer/fees";
import { useWallet } from "../genlayer/wallet";
import { success, error, configError } from "../utils/toast";
import type { Task } from "../contracts/types";

export function useAgentEscrowContract(): AgentEscrow | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const rpcUrl = getStudioUrl();

  const contract = useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Contract address not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.",
        { label: "Setup Guide", onClick: () => window.open("/docs/setup", "_blank") }
      );
      return null;
    }
    return new AgentEscrow(contractAddress, address, rpcUrl);
  }, [contractAddress, address, rpcUrl]);

  return contract;
}

export function useTasks() {
  const contract = useAgentEscrowContract();

  return useQuery<Task[], Error>({
    queryKey: ["tasks"],
    queryFn: () => (contract ? contract.getAllTasks() : Promise.resolve([])),
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract,
  });
}

export function useTasksByRequester(address: string | null) {
  const contract = useAgentEscrowContract();

  return useQuery<Task[], Error>({
    queryKey: ["tasksByRequester", address],
    queryFn: () => (contract ? contract.getTasksByRequester(address) : Promise.resolve([])),
    refetchOnWindowFocus: true,
    enabled: !!address && !!contract,
    staleTime: 2000,
  });
}

export function useTasksByWorker(address: string | null) {
  const contract = useAgentEscrowContract();

  return useQuery<Task[], Error>({
    queryKey: ["tasksByWorker", address],
    queryFn: () => (contract ? contract.getTasksByWorker(address) : Promise.resolve([])),
    refetchOnWindowFocus: true,
    enabled: !!address && !!contract,
    staleTime: 2000,
  });
}

export function useCreateTask() {
  const contract = useAgentEscrowContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      worker, sourceUrl, factDescription, amountWei, feePresetLevel,
    }: {
      worker: string; sourceUrl: string; factDescription: string; amountWei: bigint; feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.");
      if (!address) throw new Error("Wallet not connected. Please connect your wallet to create a task.");
      setIsCreating(true);
      setPendingTxHash(null);
      const feePreset = await contract.estimateCreateTaskFees(worker, sourceUrl, factDescription, feePresetLevel ?? "standard");
      return contract.createTask(worker, sourceUrl, factDescription, amountWei, feePreset, setPendingTxHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasksByRequester"] });
      queryClient.invalidateQueries({ queryKey: ["tasksByWorker"] });
      setIsCreating(false);
      success("Task created!", { description: "Your escrowed task is now live." });
    },
    onError: (err: any) => {
      console.error("Error creating task:", err);
      setIsCreating(false);
      error("Failed to create task", { description: err?.message || "Please try again." });
    },
  });

  return {
    ...mutation,
    isCreating,
    pendingTxHash,
    clearPendingTx: () => setPendingTxHash(null),
    createTask: mutation.mutate,
    createTaskAsync: mutation.mutateAsync,
  };
}

export function useCancelTask() {
  const contract = useAgentEscrowContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!contract) throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.");
      if (!address) throw new Error("Wallet not connected. Please connect your wallet to cancel a task.");
      setIsCancelling(true);
      setCancellingTaskId(taskId);
      setPendingTxHash(null);
      return contract.cancelTask(taskId, setPendingTxHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasksByRequester"] });
      setIsCancelling(false);
      setCancellingTaskId(null);
      success("Task cancelled", { description: "Your escrow has been refunded." });
    },
    onError: (err: any) => {
      console.error("Error cancelling task:", err);
      setIsCancelling(false);
      setCancellingTaskId(null);
      error("Failed to cancel task", { description: err?.message || "Please try again." });
    },
  });

  return {
    ...mutation,
    isCancelling,
    cancellingTaskId,
    pendingTxHash,
    clearPendingTx: () => setPendingTxHash(null),
    cancelTask: mutation.mutate,
  };
}

export function useSubmitDeliverable() {
  const contract = useAgentEscrowContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      taskId, reportedValue, feePresetLevel,
    }: { taskId: string; reportedValue: string; feePresetLevel?: FeePresetLevel }) => {
      if (!contract) throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.");
      if (!address) throw new Error("Wallet not connected. Please connect your wallet to submit a deliverable.");
      setIsSubmitting(true);
      setSubmittingTaskId(taskId);
      setPendingTxHash(null);
      const feePreset = await contract.estimateSubmitDeliverableFees(taskId, reportedValue, feePresetLevel ?? "standard");
      return contract.submitDeliverable(taskId, reportedValue, feePreset, setPendingTxHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasksByWorker"] });
      setIsSubmitting(false);
      setSubmittingTaskId(null);
      success("Deliverable submitted!", { description: "Anyone can now trigger adjudication." });
    },
    onError: (err: any) => {
      console.error("Error submitting deliverable:", err);
      setIsSubmitting(false);
      setSubmittingTaskId(null);
      error("Failed to submit deliverable", { description: err?.message || "Please try again." });
    },
  });

  return {
    ...mutation,
    isSubmitting,
    submittingTaskId,
    pendingTxHash,
    clearPendingTx: () => setPendingTxHash(null),
    submitDeliverable: mutation.mutate,
  };
}

export function useAdjudicate() {
  const contract = useAgentEscrowContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isAdjudicating, setIsAdjudicating] = useState(false);
  const [adjudicatingTaskId, setAdjudicatingTaskId] = useState<string | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!contract) throw new Error("Contract not configured. Please set NEXT_PUBLIC_CONTRACT_ADDRESS in your .env file.");
      if (!address) throw new Error("Wallet not connected. Please connect your wallet to adjudicate a task.");
      setIsAdjudicating(true);
      setAdjudicatingTaskId(taskId);
      setPendingTxHash(null);
      return contract.adjudicate(taskId, setPendingTxHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasksByRequester"] });
      queryClient.invalidateQueries({ queryKey: ["tasksByWorker"] });
      setIsAdjudicating(false);
      setAdjudicatingTaskId(null);
      success("Task adjudicated!", { description: "Validators reached a verdict." });
    },
    onError: (err: any) => {
      console.error("Error adjudicating task:", err);
      setIsAdjudicating(false);
      setAdjudicatingTaskId(null);
      error("Failed to adjudicate task", { description: err?.message || "Please try again." });
    },
  });

  return {
    ...mutation,
    isAdjudicating,
    adjudicatingTaskId,
    pendingTxHash,
    clearPendingTx: () => setPendingTxHash(null),
    adjudicate: mutation.mutate,
  };
}
