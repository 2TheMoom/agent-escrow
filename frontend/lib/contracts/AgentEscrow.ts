import { createClient } from "genlayer-js";
import { getGenLayerChain } from "../genlayer/chains";
import type { Task } from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";

/**
 * genlayer-js decodes Python dataclasses (and dicts/TreeMaps) as JS Map
 * instances, keyed by field/dict-key name. This flattens one level of that
 * into a plain object, and normalizes Address-typed fields to a
 * checksummed hex string.
 */
function decodeTask(raw: any): Task {
  const entries = raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw ?? {});
  const obj: Record<string, any> = {};
  for (const [key, value] of entries) {
    obj[key] = value && typeof value === "object" && "as_hex" in value ? value.as_hex : value;
  }
  return {
    id: String(obj.id ?? ""),
    requester: String(obj.requester ?? ""),
    worker: String(obj.worker ?? ""),
    source_url: String(obj.source_url ?? ""),
    fact_description: String(obj.fact_description ?? ""),
    amount: String(obj.amount ?? "0"),
    status: (obj.status ?? "open") as Task["status"],
    reported_value: String(obj.reported_value ?? ""),
    verdict_reasoning: String(obj.verdict_reasoning ?? ""),
  };
}

/**
 * AgentEscrow contract class for interacting with the GenLayer
 * agent-to-agent verified-data-delivery escrow contract.
 */
class AgentEscrow {
  private contractAddress: `0x${string}`;
  private client: any;
  private rpcUrl?: string;

  constructor(contractAddress: string, address?: string | null, rpcUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.rpcUrl = rpcUrl;

    const config: any = { chain: getGenLayerChain() };
    if (address) config.account = address as `0x${string}`;
    if (rpcUrl) config.endpoint = rpcUrl;

    this.client = createClient(config);
  }

  updateAccount(address: string): void {
    const config: any = { chain: getGenLayerChain(), account: address as `0x${string}` };
    if (this.rpcUrl) config.endpoint = this.rpcUrl;
    this.client = createClient(config);
  }

  async estimateCreateTaskFees(
    worker: string,
    sourceUrl: string,
    factDescription: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      { address: this.contractAddress, functionName: "create_task", args: [worker, sourceUrl, factDescription] },
      level,
    );
  }

  async estimateSubmitDeliverableFees(
    taskId: string,
    reportedValue: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      { address: this.contractAddress, functionName: "submit_deliverable", args: [taskId, reportedValue] },
      level,
    );
  }

  async estimateAdjudicateFees(
    taskId: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      { address: this.contractAddress, functionName: "adjudicate", args: [taskId] },
      level,
    );
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      const result: any = await this.client.readContract({
        address: this.contractAddress, functionName: "get_all_tasks", args: [],
      });
      if (result instanceof Map) return Array.from(result.values()).map(decodeTask);
      if (result && typeof result === "object") return Object.values(result).map(decodeTask);
      return [];
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw new Error("Failed to fetch tasks from contract");
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    try {
      const result = await this.client.readContract({
        address: this.contractAddress, functionName: "get_task", args: [taskId],
      });
      return decodeTask(result);
    } catch (error) {
      console.error("Error fetching task:", error);
      return null;
    }
  }

  async getTasksByRequester(address: string | null): Promise<Task[]> {
    if (!address) return [];
    try {
      const result: any = await this.client.readContract({
        address: this.contractAddress, functionName: "get_tasks_by_requester", args: [address],
      });
      return Array.isArray(result) ? result.map(decodeTask) : [];
    } catch (error) {
      console.error("Error fetching tasks by requester:", error);
      return [];
    }
  }

  async getTasksByWorker(address: string | null): Promise<Task[]> {
    if (!address) return [];
    try {
      const result: any = await this.client.readContract({
        address: this.contractAddress, functionName: "get_tasks_by_worker", args: [address],
      });
      return Array.isArray(result) ? result.map(decodeTask) : [];
    } catch (error) {
      console.error("Error fetching tasks by worker:", error);
      return [];
    }
  }

  /**
   * Creates a new task, escrowing `amountWei` as payment for `worker` to
   * report `factDescription` as found at `sourceUrl`.
   */
  async createTask(
    worker: string,
    sourceUrl: string,
    factDescription: string,
    amountWei: bigint,
    feePreset?: FeePresetEstimate,
    onSubmitted?: (txHash: string) => void
  ): Promise<string> {
    const fees = feePresetToTransactionFees(feePreset);
    let txHash: string;
    try {
      txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "create_task",
        args: [worker, sourceUrl, factDescription],
        value: amountWei,
        ...(fees ? { fees } : {}),
      });
    } catch (error) {
      console.error("Error creating task:", error);
      throw new Error("Failed to submit the create-task transaction. Please try again.");
    }

    onSubmitted?.(txHash);

    try {
      await this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 24, interval: 5000 });
      return txHash;
    } catch (error) {
      console.error("Error confirming create-task transaction:", error);
      throw new Error(
        `Transaction ${txHash} was submitted but confirmation timed out. It may still complete - check the explorer.`
      );
    }
  }

  async cancelTask(taskId: string, onSubmitted?: (txHash: string) => void): Promise<string> {
    let txHash: string;
    try {
      txHash = await this.client.writeContract({
        address: this.contractAddress, functionName: "cancel_task", args: [taskId], value: BigInt(0),
      });
    } catch (error) {
      console.error("Error cancelling task:", error);
      throw new Error("Failed to submit the cancel transaction. Please try again.");
    }

    onSubmitted?.(txHash);

    try {
      await this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 24, interval: 5000 });
      return txHash;
    } catch (error) {
      console.error("Error confirming cancel transaction:", error);
      throw new Error(
        `Transaction ${txHash} was submitted but confirmation timed out. It may still complete - check the explorer.`
      );
    }
  }

  async submitDeliverable(
    taskId: string,
    reportedValue: string,
    feePreset?: FeePresetEstimate,
    onSubmitted?: (txHash: string) => void
  ): Promise<string> {
    const fees = feePresetToTransactionFees(feePreset);
    let txHash: string;
    try {
      txHash = await this.client.writeContract({
        address: this.contractAddress,
        functionName: "submit_deliverable",
        args: [taskId, reportedValue],
        value: BigInt(0),
        ...(fees ? { fees } : {}),
      });
    } catch (error) {
      console.error("Error submitting deliverable:", error);
      throw new Error("Failed to submit the deliverable transaction. Please try again.");
    }

    onSubmitted?.(txHash);

    try {
      await this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 24, interval: 5000 });
      return txHash;
    } catch (error) {
      console.error("Error confirming deliverable transaction:", error);
      throw new Error(
        `Transaction ${txHash} was submitted but confirmation timed out. It may still complete - check the explorer.`
      );
    }
  }

  async adjudicate(taskId: string, onSubmitted?: (txHash: string) => void): Promise<string> {
    const feePreset = await this.estimateAdjudicateFees(taskId);
    const fees = feePresetToTransactionFees(feePreset);
    let txHash: string;
    try {
      txHash = await this.client.writeContract({
        address: this.contractAddress, functionName: "adjudicate", args: [taskId], value: BigInt(0),
        ...(fees ? { fees } : {}),
      });
    } catch (error) {
      console.error("Error adjudicating task:", error);
      throw new Error("Failed to submit the adjudication transaction. Please try again.");
    }

    onSubmitted?.(txHash);

    try {
      await this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 24, interval: 5000 });
      return txHash;
    } catch (error) {
      console.error("Error confirming adjudication transaction:", error);
      throw new Error(
        `Transaction ${txHash} was submitted but confirmation timed out. It may still complete - check the explorer.`
      );
    }
  }
}

export default AgentEscrow;
