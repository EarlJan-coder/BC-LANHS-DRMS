// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentRequestAudit {
    struct AuditRecord {
        string referenceType;
        string referenceId;
        string action;
        string actorRole;
        bytes32 recordHash;
        uint256 timestamp;
    }

    AuditRecord[] private auditRecords;

    event AuditRecordAdded(
        uint256 indexed index,
        string referenceType,
        string referenceId,
        string action,
        string actorRole,
        bytes32 recordHash,
        uint256 timestamp
    );

    function addAuditRecord(
        string calldata referenceType,
        string calldata referenceId,
        string calldata action,
        string calldata actorRole,
        bytes32 recordHash
    ) external {
        auditRecords.push(
            AuditRecord({
                referenceType: referenceType,
                referenceId: referenceId,
                action: action,
                actorRole: actorRole,
                recordHash: recordHash,
                timestamp: block.timestamp
            })
        );

        emit AuditRecordAdded(
            auditRecords.length - 1,
            referenceType,
            referenceId,
            action,
            actorRole,
            recordHash,
            block.timestamp
        );
    }

    function getAuditCount() external view returns (uint256) {
        return auditRecords.length;
    }

    function getAuditRecord(uint256 index) external view returns (
        string memory referenceType,
        string memory referenceId,
        string memory action,
        string memory actorRole,
        bytes32 recordHash,
        uint256 timestamp
    ) {
        AuditRecord storage record = auditRecords[index];
        return (
            record.referenceType,
            record.referenceId,
            record.action,
            record.actorRole,
            record.recordHash,
            record.timestamp
        );
    }
}
