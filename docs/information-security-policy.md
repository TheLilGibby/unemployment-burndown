# RAG Consulting LLC — Information Security Policy

**Version:** 1.0
**Effective Date:** February 27, 2026
**Last Reviewed:** February 27, 2026
**Owner:** Information Security Officer, RAG Consulting LLC

---

## 1. Purpose

This policy establishes the framework for protecting the confidentiality, integrity, and availability of information assets managed by RAG Consulting LLC ("the Company"), including consumer financial data accessed through third-party integrations such as Plaid.

## 2. Scope

This policy applies to:
- All employees, contractors, and third-party service providers with access to Company systems
- All information assets including production infrastructure, application code, consumer data, and internal systems
- All environments: development, staging, and production

## 3. Information Security Governance

### 3.1 Roles and Responsibilities

- **Information Security Officer (ISO):** Responsible for maintaining and enforcing this policy, conducting risk assessments, managing incident response, and ensuring compliance with applicable regulations.
- **Development Team:** Responsible for following secure development practices, conducting code reviews, and remediating identified vulnerabilities.
- **All Personnel:** Responsible for adhering to this policy and reporting security incidents.

### 3.2 Policy Review

This policy is reviewed at minimum annually and updated as needed in response to:
- Changes in the threat landscape
- Regulatory or compliance changes
- Results of security assessments or audits
- Significant changes to infrastructure or application architecture

## 4. Risk Management

### 4.1 Risk Assessment

The Company conducts risk assessments to identify, evaluate, and prioritize information security risks. Assessments are performed:
- Annually as part of the security program review
- When significant changes are made to the application or infrastructure
- In response to security incidents

### 4.2 Risk Treatment

Identified risks are addressed through one of the following strategies:
- **Mitigate:** Implement controls to reduce risk to an acceptable level
- **Accept:** Formally document acceptance of residual risk with business justification
- **Transfer:** Shift risk through insurance or contractual agreements
- **Avoid:** Eliminate the activity that introduces the risk

## 5. Data Classification

| Classification | Description | Examples |
|---|---|---|
| **Confidential** | Consumer financial data, authentication credentials, API keys | Plaid access tokens, bank account balances, transaction data |
| **Internal** | Business data not intended for public disclosure | Application configuration, internal documentation, employee data |
| **Public** | Information approved for public access | Marketing materials, published privacy policy |

## 6. Access Control

### 6.1 Principles

- **Least Privilege:** Users and services are granted only the minimum permissions required to perform their function.
- **Role-Based Access Control (RBAC):** Access is assigned based on job function through AWS IAM roles and policies.
- **Separation of Duties:** Critical operations require multiple approvals where feasible.

### 6.2 Authentication

- Multi-factor authentication (MFA) is required for:
  - AWS Console access
  - GitHub repository access
  - Production infrastructure access
- Service accounts use scoped IAM roles with temporary credentials where possible.

### 6.3 Access Reviews

Access to production systems and sensitive data stores is reviewed quarterly. Unused or excessive permissions are revoked promptly.

## 7. Infrastructure Security

### 7.1 Cloud Infrastructure (AWS)

- All production workloads run on AWS managed services (Lambda, API Gateway, DynamoDB, S3).
- Network access is restricted through API Gateway resource policies and IAM-based authorization.
- S3 buckets storing consumer data have:
  - All public access blocked
  - Server-side encryption enabled (AES-256 / SSE-S3)
  - Access restricted to authorized Lambda execution roles only

### 7.2 Encryption

- **In Transit:** All data is encrypted using TLS 1.2 or higher. API Gateway and AWS Amplify enforce HTTPS. The development server enforces TLS 1.2+ via HTTPS with auto-generated certificates. Plaid API communication uses TLS.
- **At Rest:** Consumer data in S3 is encrypted with SSE-S3 (AES-256). DynamoDB tables use AWS-managed encryption at rest by default. Plaid access tokens are additionally encrypted at the application layer using AES-256-GCM before storage in DynamoDB.

### 7.3 Secrets Management

- Application secrets (API keys, credentials) are stored as encrypted environment variables in AWS Lambda or AWS Systems Manager Parameter Store.
- Secrets are never committed to source code repositories.
- API keys and tokens are rotated on a defined schedule or immediately upon suspected compromise.

## 8. Secure Development

### 8.1 Secure Development Lifecycle

- All code changes go through pull request review before merging.
- Dependency vulnerabilities are monitored via GitHub Dependabot.
- Sensitive data is never logged or exposed in error messages.

### 8.2 Vulnerability Management

- Automated dependency scanning is enabled via GitHub Dependabot alerts.
- Critical and high-severity vulnerabilities are remediated within 30 days.
- Medium-severity vulnerabilities are remediated within 90 days.

## 9. Incident Response

### 9.1 Incident Classification

| Severity | Description | Response Time |
|---|---|---|
| **Critical** | Active data breach, credential compromise | Immediate (within 1 hour) |
| **High** | Vulnerability actively exploited, unauthorized access detected | Within 4 hours |
| **Medium** | New vulnerability identified, suspicious activity | Within 24 hours |
| **Low** | Minor policy violation, informational alert | Within 5 business days |

### 9.2 Incident Response Process

1. **Detection:** Identify the incident through monitoring, alerts, or reports.
2. **Containment:** Isolate affected systems to prevent further impact.
3. **Investigation:** Determine the scope, root cause, and affected data.
4. **Remediation:** Fix the underlying issue and restore normal operations.
5. **Notification:** Notify affected parties and partners (including Plaid) as required by applicable law and contractual obligations.
6. **Post-Incident Review:** Document findings, lessons learned, and improvements.

## 10. Third-Party Risk Management

### 10.1 Plaid Integration

- Consumer financial data received through the Plaid API is treated as Confidential.
- Plaid access tokens are encrypted with AES-256-GCM at the application layer before storage in DynamoDB, with access limited to authorized Lambda functions.
- Data received from Plaid is used solely for the purposes disclosed in our privacy policy and consented to by the consumer.

### 10.2 Vendor Assessment

Third-party services that handle consumer data are evaluated for security practices before integration and reviewed periodically thereafter.

## 11. Data Retention and Disposal

- Consumer financial data is retained only as long as necessary to provide the requested service.
- Users may request deletion of their data at any time.
- Upon account deletion or user request, all consumer data including Plaid tokens, account balances, and transaction history is permanently deleted from all storage systems.
- Details of the retention schedule and deletion procedures are maintained in the Data Retention and Deletion Policy.

## 12. Compliance

This policy is designed to support compliance with:
- Applicable state and federal data privacy laws
- Plaid's security and compliance requirements
- Industry best practices (NIST Cybersecurity Framework, OWASP)

## 13. Policy Violations

Violations of this policy may result in disciplinary action, up to and including termination of employment or contract, and may be reported to relevant authorities where required by law.

---

**Document Control**

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-02-27 | RAG Consulting LLC | Initial release |
