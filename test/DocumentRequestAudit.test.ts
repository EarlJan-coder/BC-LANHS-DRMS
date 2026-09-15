import { expect } from "chai";
import { ethers } from "hardhat";
import { DocumentRequestAudit } from "../typechain-types";

describe("DocumentRequestAudit", function () {
  let contract: DocumentRequestAudit;

  beforeEach(async function () {
    const factory = await ethers.getContractFactory("DocumentRequestAudit");
    contract = (await factory.deploy()) as DocumentRequestAudit;
  });

  describe("addAuditRecord", function () {
    it("should add a record and emit event", async function () {
      const tx = await contract.addAuditRecord(
        "DocumentRequest",
        "req-1",
        "created",
        "citizen",
        ethers.encodeBytes32String("hash1"),
      );

      await expect(tx)
        .to.emit(contract, "AuditRecordAdded")
        .withArgs(
          0,
          "DocumentRequest",
          "req-1",
          "created",
          "citizen",
          ethers.encodeBytes32String("hash1"),
          (value: bigint) => value > 0n,
          "",
          ethers.ZeroHash,
        );
    });

    it("should increment audit count", async function () {
      await contract.addAuditRecord("DocumentRequest", "req-1", "created", "citizen", ethers.encodeBytes32String("hash1"));
      expect(await contract.getAuditCount()).to.equal(1);

      await contract.addAuditRecord("DocumentRequest", "req-1", "approved", "staff", ethers.encodeBytes32String("hash2"));
      expect(await contract.getAuditCount()).to.equal(2);
    });
  });

  describe("recordCertificateEvent", function () {
    it("should add a certificate event and emit event with eventType", async function () {
      const tx = await contract.recordCertificateEvent(
        "CERTIFICATE_ISSUED",
        "CERT-001",
        "Certificate generated",
        "registrar",
        ethers.encodeBytes32String("hash1"),
        ethers.ZeroHash,
      );

      await expect(tx)
        .to.emit(contract, "AuditRecordAdded")
        .withArgs(
          0,
          "certificate",
          "CERT-001",
          "Certificate generated",
          "registrar",
          ethers.encodeBytes32String("hash1"),
          (value: bigint) => value > 0n,
          "CERTIFICATE_ISSUED",
          ethers.ZeroHash,
        );
    });

    it("should store previousRecordHash for reissuance", async function () {
      await contract.recordCertificateEvent(
        "CERTIFICATE_ISSUED",
        "CERT-001",
        "Certificate generated",
        "registrar",
        ethers.encodeBytes32String("hash1"),
        ethers.ZeroHash,
      );

      const tx = await contract.recordCertificateEvent(
        "CERTIFICATE_REISSUED",
        "CERT-001",
        "Certificate reissued",
        "registrar",
        ethers.encodeBytes32String("hash2"),
        ethers.encodeBytes32String("hash1"),
      );

      await expect(tx).to.emit(contract, "AuditRecordAdded");

      const record = await contract.getAuditRecordFull(1);
      expect(record.eventType).to.equal("CERTIFICATE_REISSUED");
      expect(record.previousRecordHash).to.equal(ethers.encodeBytes32String("hash1"));
    });

    it("should index certificate events by reference", async function () {
      await contract.recordCertificateEvent(
        "CERTIFICATE_ISSUED",
        "CERT-001",
        "Certificate generated",
        "registrar",
        ethers.encodeBytes32String("hash1"),
        ethers.ZeroHash,
      );
      await contract.recordCertificateEvent(
        "CERTIFICATE_VOIDED",
        "CERT-001",
        "Certificate voided",
        "admin",
        ethers.encodeBytes32String("hash2"),
        ethers.encodeBytes32String("hash1"),
      );

      const indices = await contract.getRecordIndices("certificate", "CERT-001");
      expect(indices.length).to.equal(2);
    });
  });

  describe("getAuditRecord", function () {
    it("should return record by index", async function () {
      await contract.addAuditRecord("DocumentRequest", "req-1", "created", "citizen", ethers.encodeBytes32String("hash1"));

      const record = await contract.getAuditRecord(0);
      expect(record.referenceType).to.equal("DocumentRequest");
      expect(record.referenceId).to.equal("req-1");
      expect(record.action).to.equal("created");
      expect(record.actorRole).to.equal("citizen");
      expect(record.recordHash).to.equal(ethers.encodeBytes32String("hash1"));
    });
  });

  describe("getAuditRecordFull", function () {
    it("should return full record with eventType and previousRecordHash", async function () {
      await contract.recordCertificateEvent(
        "CERTIFICATE_ISSUED",
        "CERT-001",
        "Certificate generated",
        "registrar",
        ethers.encodeBytes32String("hash1"),
        ethers.ZeroHash,
      );

      const record = await contract.getAuditRecordFull(0);
      expect(record.referenceType).to.equal("certificate");
      expect(record.referenceId).to.equal("CERT-001");
      expect(record.eventType).to.equal("CERTIFICATE_ISSUED");
      expect(record.previousRecordHash).to.equal(ethers.ZeroHash);
    });
  });

  describe("getRecordIndices", function () {
    it("should return indices for a reference", async function () {
      await contract.addAuditRecord("DocumentRequest", "req-1", "created", "citizen", ethers.encodeBytes32String("hash1"));
      await contract.addAuditRecord("DocumentRequest", "req-1", "approved", "staff", ethers.encodeBytes32String("hash2"));
      await contract.addAuditRecord("DocumentRequest", "req-2", "created", "citizen", ethers.encodeBytes32String("hash3"));

      const indices = await contract.getRecordIndices("DocumentRequest", "req-1");
      expect(indices.length).to.equal(2);
      expect(indices[0]).to.equal(0);
      expect(indices[1]).to.equal(1);
    });

    it("should return empty array for non-existent reference", async function () {
      const indices = await contract.getRecordIndices("DocumentRequest", "non-existent");
      expect(indices.length).to.equal(0);
    });
  });

  describe("getLatestAuditRecord", function () {
    it("should return the latest record for a reference", async function () {
      await contract.addAuditRecord("DocumentRequest", "req-1", "created", "citizen", ethers.encodeBytes32String("hash1"));
      await contract.addAuditRecord("DocumentRequest", "req-1", "approved", "staff", ethers.encodeBytes32String("hash2"));

      const record = await contract.getLatestAuditRecord("DocumentRequest", "req-1");
      expect(record[0]).to.equal("DocumentRequest");
      expect(record[1]).to.equal("req-1");
      expect(record[2]).to.equal("approved");
      expect(record[3]).to.equal("staff");
      expect(record[4]).to.equal(ethers.encodeBytes32String("hash2"));
    });

    it("should revert when no records exist", async function () {
      await expect(contract.getLatestAuditRecord("DocumentRequest", "non-existent")).to.be.revertedWith("Not found");
    });
  });

  describe("getLatestAuditRecordFull", function () {
    it("should return the latest full record with eventType", async function () {
      await contract.recordCertificateEvent(
        "CERTIFICATE_ISSUED",
        "CERT-001",
        "Certificate generated",
        "registrar",
        ethers.encodeBytes32String("hash1"),
        ethers.ZeroHash,
      );
      await contract.recordCertificateEvent(
        "CERTIFICATE_VOIDED",
        "CERT-001",
        "Certificate voided",
        "admin",
        ethers.encodeBytes32String("hash2"),
        ethers.encodeBytes32String("hash1"),
      );

      const record = await contract.getLatestAuditRecordFull("certificate", "CERT-001");
      expect(record.eventType).to.equal("CERTIFICATE_VOIDED");
      expect(record.previousRecordHash).to.equal(ethers.encodeBytes32String("hash1"));
    });
  });
});
