import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { DOCUMENT_REQUEST_AUDIT_ABI } from "./abi";

export type ChainAuditPayload = {
  referenceId: string;
  action: string;
  actorRole: string;
  recordHash: string;
};

export type ChainAuditResult =
  | { ok: true; transactionHash: string; contractAddress: string }
  | { ok: false; error: string; contractAddress?: string };

export function getAuditContract() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  const contractAddress = process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS;

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
      contractAddress: process.env.DOCUMENT_AUDIT_CONTRACT_ADDRESS,
    };
  }

  try {
    const tx = await contract.addAuditRecord(
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

