import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { DOCUMENT_REQUEST_AUDIT_ABI } from "./abi";

export type ChainAuditPayload = {
  referenceType: string;
  referenceId: string;
  action: string;
  actorRole: string;
  recordHash: string;
};

export type ChainLifecycleEventPayload = {
  eventType: string;
  referenceId: string;
  action: string;
  actorRole: string;
  recordHash: string;
  previousRecordHash: string;
};

export type ChainAuditResult =
  | { ok: true; transactionHash: string; contractAddress: string; blockNumber: number }
  | { ok: false; error: string; contractAddress?: string };

export type OnChainAuditRecord = {
  referenceType: string;
  referenceId: string;
  action: string;
  actorRole: string;
  recordHash: string;
  timestamp: number;
  eventType: string;
  previousRecordHash: string;
};

export function getAuditContract() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL ?? process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  return new Contract(contractAddress, DOCUMENT_REQUEST_AUDIT_ABI, wallet);
}

export async function submitAuditToChain(payload: ChainAuditPayload): Promise<ChainAuditResult> {
  const contract = getAuditContract();

  if (!contract) {
    return {
      ok: false,
      error: "Blockchain environment is not configured.",
      contractAddress: process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS,
    };
  }

  try {
    const tx = await contract.addAuditRecord(
      payload.referenceType,
      payload.referenceId,
      payload.action,
      payload.actorRole,
      payload.recordHash,
    );
    const receipt = await tx.wait();

    return {
      ok: true,
      transactionHash: receipt.hash,
      contractAddress: await contract.getAddress(),
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown blockchain submission error.",
      contractAddress: await contract.getAddress(),
    };
  }
}

export async function submitLifecycleEventToChain(payload: ChainLifecycleEventPayload): Promise<ChainAuditResult> {
  const contract = getAuditContract();

  if (!contract) {
    return {
      ok: false,
      error: "Blockchain environment is not configured.",
      contractAddress: process.env.CONTRACT_ADDRESS ?? process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS,
    };
  }

  try {
    const tx = await contract.recordCertificateEvent(
      payload.eventType,
      payload.referenceId,
      payload.action,
      payload.actorRole,
      payload.recordHash,
      payload.previousRecordHash,
    );
    const receipt = await tx.wait();

    return {
      ok: true,
      transactionHash: receipt.hash,
      contractAddress: await contract.getAddress(),
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown blockchain submission error.",
      contractAddress: await contract.getAddress(),
    };
  }
}

export async function readAuditCount() {
  const contract = getAuditContract();
  if (!contract) {
    return 0;
  }

  const count = await contract.getAuditCount();
  return Number(count);
}

export async function getRecordIndices(referenceType: string, referenceId: string): Promise<number[]> {
  const contract = getAuditContract();
  if (!contract) return [];
  try {
    const indices = await contract.getRecordIndices(referenceType, referenceId);
    return indices.map((i: bigint) => Number(i));
  } catch {
    return [];
  }
}

export async function getLatestAuditRecord(referenceType: string, referenceId: string) {
  const contract = getAuditContract();
  if (!contract) return null;
  try {
    const [refType, refId, action, actorRole, recordHash, timestamp] =
      await contract.getLatestAuditRecord(referenceType, referenceId);
    return {
      referenceType: refType as string,
      referenceId: refId as string,
      action: action as string,
      actorRole: actorRole as string,
      recordHash: recordHash as string,
      timestamp: Number(timestamp),
    };
  } catch {
    return null;
  }
}

export async function getAuditRecordFull(index: number): Promise<OnChainAuditRecord | null> {
  const contract = getAuditContract();
  if (!contract) return null;
  try {
    const record = await contract.getAuditRecordFull(index);
    return {
      referenceType: record.referenceType as string,
      referenceId: record.referenceId as string,
      action: record.action as string,
      actorRole: record.actorRole as string,
      recordHash: record.recordHash as string,
      timestamp: Number(record.timestamp),
      eventType: record.eventType as string,
      previousRecordHash: record.previousRecordHash as string,
    };
  } catch {
    return null;
  }
}

export async function getLatestAuditRecordFull(referenceType: string, referenceId: string): Promise<OnChainAuditRecord | null> {
  const contract = getAuditContract();
  if (!contract) return null;
  try {
    const record = await contract.getLatestAuditRecordFull(referenceType, referenceId);
    return {
      referenceType: record.referenceType as string,
      referenceId: record.referenceId as string,
      action: record.action as string,
      actorRole: record.actorRole as string,
      recordHash: record.recordHash as string,
      timestamp: Number(record.timestamp),
      eventType: record.eventType as string,
      previousRecordHash: record.previousRecordHash as string,
    };
  } catch {
    return null;
  }
}
