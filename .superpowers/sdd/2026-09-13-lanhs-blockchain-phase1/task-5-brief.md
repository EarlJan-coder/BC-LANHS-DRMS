### Task 5: Integrate Verification into Public Verify Page (Phase 1.5)

**Files:**
- Modify: `src/app/verify-certificate/[verificationCode]/page.tsx`
- Create: `src/components/BlockchainVerificationBadge.tsx`

**Interfaces:**
- Consumes: `verifyCertificateOnChain` from `blockchain-verification.ts`
- Produces: Updated verify page with blockchain status UI

- [ ] **Step 1: Create BlockchainVerificationBadge component**

```tsx
// src/components/BlockchainVerificationBadge.tsx
import { CheckCircle2, AlertCircle, Clock, ExternalLink } from 'lucide-react';

interface BlockchainVerificationBadgeProps {
  result: VerificationResult;
}

export function BlockchainVerificationBadge({ result }: BlockchainVerificationBadgeProps) {
  if (!result.blockchainVerified) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Blockchain proof pending
        </p>
        <p className="mt-1 text-sm">{result.reason ?? 'Certificate has not been submitted to blockchain yet.'}</p>
      </div>
    );
  }

  const isValid = result.valid;
  const explorerUrl = result.network === 'sepolia' 
    ? `https://sepolia.etherscan.io/tx/${result.transactionHash}`
    : result.network === 'hardhat'
    ? `http://localhost:8545/tx/${result.transactionHash}`
    : null;

  return (
    <div className={`rounded-md border p-4 ${
      isValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
      : 'border-red-200 bg-red-50 text-red-800'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        {isValid ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <AlertCircle className="h-5 w-5" />
        )}
        <p className="text-sm font-semibold">
          {isValid ? 'Hash matches on-chain record' : 'Hash mismatch detected'}
        </p>
      </div>
      <div className="grid gap-2 text-sm">
        {result.transactionHash && (
          <div className="flex items-center gap-2">
            <span className="font-medium">Tx Hash:</span>
            <code className="break-all bg-slate-100 px-2 py-1 rounded">{result.transactionHash}</code>
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand hover:underline">
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
      {!isValid && result.reason && (
        <p className="mt-2 text-sm">{result.reason}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update verify page**

```tsx
// src/app/verify-certificate/[verificationCode]/page.tsx
import { verifyCertificate } from '@/lib/services/certificates';
import { verifyCertificateOnChain } from '@/lib/services/blockchain-verification';
import { BlockchainVerificationBadge } from '@/components/BlockchainVerificationBadge';
import { getDb } from '@/db';
import { certificates } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ verificationCode: string }>;
}) {
  const { verificationCode } = await params;
  const result = await verifyCertificate(verificationCode).catch(() => ({ valid: false }));
  
  let blockchainResult;
  if (result.valid && result.certificateNumber) {
    // Find certificate ID from certificateNumber
    const db = getDb();
    const cert = await db.query.certificates.findFirst({
      where: eq(certificates.certificateNumber, result.certificateNumber),
    });
    if (cert) {
      blockchainResult = await verifyCertificateOnChain(cert.id);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.valid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Certificate verification
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className={...}>
              {/* existing validity badge */}
            </div>

            {result.valid ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {/* existing details */}
              </div>
            ) : null}

            {blockchainResult && (
              <BlockchainVerificationBadge result={blockchainResult} />
            )}

            <div className="flex gap-3 rounded-md bg-rose-50 p-4 text-sm text-brand">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Public verification does not expose full grades or private student information.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```