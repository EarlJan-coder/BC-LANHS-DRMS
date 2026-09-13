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
    mapping(string => mapping(string => uint256[])) private indexByRef;

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
        uint256 index = auditRecords.length;
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
        indexByRef[referenceType][referenceId].push(index);

        emit AuditRecordAdded(
            index,
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

    function getRecordIndices(string calldata referenceType, string calldata referenceId)
        external view returns (uint256[] memory) {
        return indexByRef[referenceType][referenceId];
    }

    function getLatestAuditRecord(string calldata referenceType, string calldata referenceId)
        external view returns (
        string memory,
        string memory,
        string memory,
        string memory,
        bytes32,
        uint256
    ) {
        uint256[] memory indices = indexByRef[referenceType][referenceId];
        if (indices.length == 0) revert("Not found");
        AuditRecord storage r = auditRecords[indices[indices.length - 1]];
        return (r.referenceType, r.referenceId, r.action, r.actorRole, r.recordHash, r.timestamp);
    }
}
