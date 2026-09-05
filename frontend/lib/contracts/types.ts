/**
 * TypeScript types for the GenLayer AgentEscrow contract
 */

export type TaskStatus = "open" | "submitted" | "accepted" | "rejected" | "cancelled";

export interface Task {
  id: string;
  requester: string;
  worker: string;
  source_url: string;
  fact_description: string;
  amount: string;
  status: TaskStatus;
  reported_value: string;
  verdict_reasoning: string;
}

export const ALLOWED_SOURCE_DOMAINS = [
  "api.coingecko.com",
  "api.coinbase.com",
  "etherscan.io",
];

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: any;
}
