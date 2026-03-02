# RAG Consulting LLC — Data Retention and Deletion Policy

**Version:** 1.1
**Effective Date:** February 27, 2026
**Last Reviewed:** March 2, 2026
**Owner:** Information Security Officer, RAG Consulting LLC

---

## 1. Purpose

This policy defines how RAG Consulting LLC ("the Company") retains, archives, and deletes consumer financial data collected through the Financial Burndown Tracker application, including data received through the Plaid API.

## 2. Scope

This policy applies to all consumer data stored in:
- Amazon S3 (application state, transaction data, parsed statements)
- Amazon DynamoDB (Plaid access tokens and sync metadata)
- Any temporary storage or caches used during processing

## 3. Data Categories and Retention Periods

| Data Category | Storage Location | Retention Period | Deletion Trigger |
|---|---|---|---|
| **Plaid access tokens** | DynamoDB | Until user disconnects the account or deletes their account | User-initiated disconnect or account deletion |
| **Account balances** | S3 (data.json) | Duration of active account | Account deletion or user request |
| **Transaction history** | S3 (data.json) | Duration of active account | Account deletion or user request |
| **Parsed credit card statements** | S3 (statements/) | Duration of active account | Account deletion or user request |
| **User-entered financial data** | S3 (data.json) | Duration of active account | Account deletion or user request |
| **Sync cursors / metadata** | DynamoDB | Until user disconnects the account | User-initiated disconnect |
| **Consent records** | DynamoDB (on user record) | Duration of active account | Account deletion |
| **Raw ingested emails** | S3 (emails/raw/) | 90 days after processing | Automatic scheduled cleanup |

## 4. Data Deletion Procedures

### 4.1 Bank Account Disconnection

When a user disconnects a linked bank account:
1. The Plaid access token for that institution is deleted from DynamoDB.
2. The sync cursor for that item is deleted.
3. Account balance data linked to that institution remains in the user's profile (for historical reference) unless the user explicitly requests its removal.
4. No further data is fetched from that institution.

### 4.2 Account Deletion (Full Data Removal)

When a user requests account deletion:
1. All data in S3 associated with the user (data.json, statements) is permanently deleted.
2. All Plaid access tokens in DynamoDB for the user are deleted.
3. All DynamoDB records (tokens, cursors, metadata) for the user are removed.
4. Deletion is completed within 30 calendar days of the request.
5. A confirmation is sent to the user upon completion.

### 4.3 Deletion Request Process

Users may request data deletion by:
- Using the "Delete Account" feature on the Settings page within the application
- Sending an email to privacy@rag-consulting.com with the subject "Data Deletion Request"

All deletion requests are logged and tracked to completion.

### 4.4 Consent Records

When a user provides consent (e.g., for Plaid data access, privacy policy acceptance, or account registration), a timestamped consent record is stored on their user profile. These records include the consent type, policy version, timestamp, and user-agent. Consent records are retained for the duration of the user's active account and are permanently deleted upon account deletion.

## 5. Automated Cleanup

The following automated cleanup processes run on a scheduled basis:
- **Raw emails (S3):** Deleted 90 days after processing via S3 lifecycle rules.
- **Expired sessions:** Browser session tokens are cleared automatically on logout or tab close.

## 6. Data Backup and Recovery

- Data stored in DynamoDB benefits from AWS point-in-time recovery (PITR) when enabled.
- Backups are retained for the minimum period required for disaster recovery.
- When a user requests data deletion, the deletion is applied to all backup copies within the backup retention window.

## 7. Compliance

This policy supports compliance with:
- Plaid's data handling requirements
- Applicable state privacy laws (including CCPA/CPRA where applicable)
- The Company's Information Security Policy and Privacy Policy

## 8. Policy Review

This policy is reviewed annually and updated as necessary to reflect changes in:
- Data processing activities
- Regulatory requirements
- Infrastructure changes

---

**Document Control**

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-27 | RAG Consulting LLC | Initial release |
| 1.1 | 2026-03-02 | RAG Consulting LLC | Added in-app account deletion, consent tracking records, periodic review note |
