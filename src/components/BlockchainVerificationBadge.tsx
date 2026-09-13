"use client";

import { CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";
import type { VerificationResult } from "@/lib/services/blockchain-verification";

interface BlockchainVerificationBadgeProps {
  result: VerificationResult;
}

export function BlockchainVerificationBadge({ result }: BlockchainVerificationBadgeProps) {
  if (!result.blockchainVerified) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4" />
          Blockchain proof pending
        </p>
        <p className="mt-1 text-sm">{result.reason ?? "Certificate has not been submitted to blockchain yet."}</p>
      </div>
    );
  }

  const isValid = result.valid;
  const explorerUrl =
    result.network === "sepolia"
      ? `https://sepolia.etherscan.io/tx/${result.transactionHash}`
      : result.network === "hardhat"
        ? `http://localhost:8545/tx/${result.transactionHash}`
        : null;

  return (
    <div
      className={`rounded-md border p-4 ${
        isValid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {isValid ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
        <p className="text-sm font-semibold">
          {isValid ? "Hash matches on-chain record" : "Hash mismatch detected"}
        </p>
      </div>
      <div className="grid gap-2 text-sm">
        {result.transactionHash && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Tx Hash:</span>
            <code className="break-all rounded bg-slate-100 px-2 py-1">{result.transactionHash}</code>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View on Etherscan
              </a>
            )}
          </div>
        )}
        {result.recordedAt && (
          <div>
            <span className="font-medium">Recorded:</span> {new Date(result.recordedAt).toLocaleString()}
          </div>
        )}
        {result.action && (
          <div>
            <span className="font-medium">Action:</span> {result.action}
          </div>
        )}
        {result.network && (
          <div>
            <span className="font-medium">Network:</span> {result.network}
          </div>
        )}
      </div>
      {!isValid && result.reason && <p className="mt-2 text-sm">{result.reason}</p>}
    </div>
  );
}