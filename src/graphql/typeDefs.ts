// EscrowVault GraphQL schema (v1). Variable-shape reads for dashboards and
// detail pages; simple mutations delegate to services/ (same rules as the
// Server Actions). BigInt sizes cross the wire as String.
export const typeDefs = /* GraphQL */ `
  enum DepositStatus {
    DRAFT
    UPLOADING
    SCANNING
    READY
    ACTIVE
    SUPERSEDED
  }

  enum AssetType {
    SOURCE
    DATABASE
    CONFIG
    DOCS
    BUILD_SCRIPT
    API_SPEC
  }

  enum ScanStatus {
    PENDING
    PASS
    FAIL
  }

  enum VerificationTier {
    VALIDATED
    VERIFIED
    CERTIFIED
  }

  enum VerificationStatus {
    QUEUED
    RUNNING
    PASSED
    FAILED
    EXPIRED
  }

  enum ReleaseStatus {
    FILED
    NOTIFIED
    DISPUTED
    UNDISPUTED
    APPROVED
    DENIED
    DELIVERED
  }

  type ReleaseCondition {
    id: ID!
    trigger: String!
    description: String!
    disputeWindowDays: Int!
  }

  type Agreement {
    id: ID!
    vendorName: String!
    beneficiaryName: String!
    status: String!
    activatedAt: String
    conditions: [ReleaseCondition!]!
    deposits: [Deposit!]!
  }

  type Asset {
    id: ID!
    type: AssetType!
    filename: String!
    sizeBytes: String!
    sha256: String!
    scanStatus: ScanStatus!
  }

  type Certificate {
    id: ID!
    tier: VerificationTier!
    serialNo: String!
    issuedAt: String!
  }

  type VerificationRun {
    id: ID!
    tier: VerificationTier!
    status: VerificationStatus!
    findings: String
    completedAt: String
    certificate: Certificate
  }

  type Deposit {
    id: ID!
    version: Int!
    status: DepositStatus!
    activatedAt: String
    createdAt: String!
    agreement: Agreement!
    assets: [Asset!]!
    verificationRuns: [VerificationRun!]!
  }

  type AuditEvent {
    id: ID!
    entity: String!
    entityId: ID!
    action: String!
    actorEmail: String
    at: String!
  }

  type Query {
    agreements: [Agreement!]!
    deposits(agreementId: ID): [Deposit!]!
    deposit(id: ID!): Deposit
    auditEvents(limit: Int = 50): [AuditEvent!]!
  }

  type Mutation {
    createDeposit(agreementId: ID!): Deposit!
    activateDeposit(depositId: ID!): Deposit!
  }
`;
