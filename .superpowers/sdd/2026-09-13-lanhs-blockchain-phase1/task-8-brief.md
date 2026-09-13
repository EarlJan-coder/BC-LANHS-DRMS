### Task 8: Final Verification & Testing

**Files:** All modified files

**Interfaces:** End-to-end verification

- [ ] **Step 1: Run all verification commands**

```bash
npm run lint
npm run build
npm run db:migrate      # against test DB
npm run chain:test
```

- [ ] **Step 2: Manual verification**
1. Generate certificate via registrar UI
2. Wait for blockchain submission (or admin retry)
3. Visit `/verify-certificate/{code}`
4. Confirm blockchain status shows ✓ with tx hash + block number
5. Test admin retry with failed submission