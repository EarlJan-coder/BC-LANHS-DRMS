import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getAuditContract, readAuditCount } from "@/lib/blockchain/client";
import { getBlockchainAuditStats } from "@/lib/services/live-data";

export type SystemHealthCheck = {
  key: "storage" | "sign-in" | "email" | "proofs";
  title: string;
  state: "working" | "attention";
  sentence: string;
  needsDeveloper: boolean;
  technical: string | null;
};

export type ProofHealth = {
  configured: boolean;
  reachable: boolean;
  pending: number;
  failed: number;
  error?: string;
};

/**
 * Injectable effects for tests (same seam pattern as `apiGuardEffects`):
 * the real checks touch the database and the chain, which route and service
 * tests must be able to drive without either. Production behavior is
 * unchanged — the seam defaults to the real checks.
 */
export const systemHealthEffects = {
  pingStorage: async () => {
    await getDb().execute(sql`select 1`);
  },
  checkProofs: async (): Promise<ProofHealth> => {
    const configured = getAuditContract() !== null;
    if (!configured) return { configured: false, reachable: false, pending: 0, failed: 0 };
    try {
      await readAuditCount();
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        pending: 0,
        failed: 0,
        error: error instanceof Error ? error.message : "The blockchain network could not be reached.",
      };
    }
    const counts = await getBlockchainAuditStats();
    return { configured: true, reachable: true, pending: counts.pending, failed: counts.failed };
  },
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

export async function getSystemHealth(): Promise<SystemHealthCheck[]> {
  let storageOk = true;
  let storageTechnical: string | null = null;
  try {
    await systemHealthEffects.pingStorage();
  } catch (error) {
    storageOk = false;
    storageTechnical = errorMessage(error);
  }

  const storage: SystemHealthCheck = storageOk
    ? {
        key: "storage",
        title: "Storage",
        state: "working",
        sentence: "Student records are safe and reachable.",
        needsDeveloper: false,
        technical: null,
      }
    : {
        key: "storage",
        title: "Storage",
        state: "attention",
        sentence: "Student records cannot be reached right now.",
        needsDeveloper: true,
        technical: storageTechnical,
      };

  const secretOk = Boolean(process.env.SESSION_SECRET);
  const signIn: SystemHealthCheck =
    secretOk && storageOk
      ? {
          key: "sign-in",
          title: "Sign-in",
          state: "working",
          sentence: "Staff and students can sign in to the portal.",
          needsDeveloper: false,
          technical: null,
        }
      : {
          key: "sign-in",
          title: "Sign-in",
          state: "attention",
          sentence: "People cannot sign in to the portal.",
          needsDeveloper: true,
          technical: secretOk ? "Storage check failed." : "SESSION_SECRET is not set.",
        };

  const emailOk = Boolean(process.env.RESEND_API_KEY);
  const email: SystemHealthCheck = emailOk
    ? {
        key: "email",
        title: "Email notifications",
        state: "working",
        sentence: "Students receive email updates about their requests.",
        needsDeveloper: false,
        technical: null,
      }
    : {
        key: "email",
        title: "Email notifications",
        state: "attention",
        sentence: "Students will not receive email updates.",
        needsDeveloper: true,
        technical: "RESEND_API_KEY is not set.",
      };

  const proofHealth = await systemHealthEffects.checkProofs();
  let proofs: SystemHealthCheck;
  if (!proofHealth.configured) {
    proofs = {
      key: "proofs",
      title: "Proof certificates",
      state: "attention",
      sentence: "Proofs that documents are genuine cannot be recorded.",
      needsDeveloper: true,
      technical: "Blockchain contract is not configured.",
    };
  } else if (!proofHealth.reachable) {
    proofs = {
      key: "proofs",
      title: "Proof certificates",
      state: "attention",
      sentence: "Proofs that documents are genuine cannot be recorded.",
      needsDeveloper: true,
      technical: proofHealth.error ?? "The blockchain network could not be reached.",
    };
  } else {
    const pendingTotal = proofHealth.pending + proofHealth.failed;
    proofs = {
      key: "proofs",
      title: "Proof certificates",
      state: "working",
      sentence:
        pendingTotal > 0
          ? "Some proof records are still being recorded."
          : "Proofs that documents are genuine are up to date.",
      needsDeveloper: false,
      technical: null,
    };
  }

  return [storage, signIn, email, proofs];
}
