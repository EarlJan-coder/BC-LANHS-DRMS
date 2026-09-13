### Task 3: Refactor DocumentRequestAudit.sol (Phase 1.3)

**Files:**
- Modify: `contracts/DocumentRequestAudit.sol`
- Modify: `src/lib/blockchain/abi.ts` (regenerate from artifact)
- Test: `test/DocumentRequestAudit.test.ts` (extend)

**Interfaces:**
- Produces: Updated contract with `getRecordIndices` and `getLatestAuditRecord` view functions

- [ ] **Step 1: Update Solidity contract**

```solidity
// contracts/DocumentRequestAudit.sol - already matches plan, verify it compiles
// The current contract already has the required functions from the plan
// Verify: getRecordIndices, getLatestAuditRecord exist
```

- [ ] **Step 2: Compile and test**

```bash
npm run chain:compile
npm run chain:test
```

- [ ] **Step 3: Deploy to local Hardhat node**

```bash
npm run chain:node &
npm run chain:deploy
# Update CONTRACT_ADDRESS in .env.local
```

- [ ] **Step 4: Regenerate ABI**

```bash
# Copy from artifacts/contracts/DocumentRequestAudit.sol/DocumentRequestAudit.json
# Update src/lib/blockchain/abi.ts with new ABI including getRecordIndices and getLatestAuditRecord
```