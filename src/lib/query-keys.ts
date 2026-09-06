import type { AppRole } from "@/lib/types/roles";

export const queryKeys = {
  reporting: {
    dashboard: (role: "hr_personnel" | "management", filters: Record<string, unknown>) => ["reporting", "dashboard", role, filters] as const,
    report: (role: "hr_personnel" | "management", filters: Record<string, unknown>) => ["reporting", "report", role, filters] as const,
  },
  appShell: () => ["app-shell"] as const,
  roleLanding: (role: AppRole) => ["role-landing", role] as const,
  administration: {
    users: (filters: Record<string, unknown>) =>
      ["administration", "users", filters] as const,
    roles: (filters: Record<string, unknown>) =>
      ["administration", "roles", filters] as const,
    departments: (filters: Record<string, unknown> = {}) =>
      ["administration", "departments", filters] as const,
    positions: (filters: Record<string, unknown> = {}) =>
      ["administration", "positions", filters] as const,
    settings: () => ["administration", "settings"] as const,
    auditLogs: (filters: Record<string, unknown>) =>
      ["administration", "audit-logs", filters] as const,
  },
  personnelRecords: {
    directory: (filters: Record<string, unknown>) => ["personnel-records", "directory", filters] as const,
    unlinkedAccounts: () => ["personnel-records", "unlinked-accounts"] as const,
    detail: (employeeId: string) => ["personnel-records", "detail", employeeId] as const,
    serviceHistory: (employeeId: string) => ["personnel-records", "service-history", employeeId] as const,
    qualifications: (employeeId: string) => ["personnel-records", "qualifications", employeeId] as const,
    certifications: (employeeId: string) => ["personnel-records", "certifications", employeeId] as const,
    training: (employeeId: string) => ["personnel-records", "training", employeeId] as const,
    profilePhoto: (objectPath: string | null) => ["personnel-records", "profile-photo", objectPath] as const,
  },
  notifications: {
    inbox: (filters: Record<string, unknown>) =>
      ["notifications", "inbox", filters] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },
  profileChangeRequests: {
    mine: (filters: Record<string, unknown>) =>
      ["profile-change-requests", "mine", filters] as const,
    detail: (requestId: string) =>
      ["profile-change-requests", "detail", requestId] as const,
    document: (objectPath: string) =>
      ["profile-change-requests", "document", objectPath] as const,
    adminQueue: (filters: Record<string, unknown>) =>
      ["profile-change-requests", "admin-queue", filters] as const,
  },
  recruitment: {
    publicJobs: (filters: Record<string, unknown>) =>
      ["recruitment", "public-jobs", filters] as const,
    job: (jobId: number) => ["recruitment", "job", jobId] as const,
    myProfile: () => ["recruitment", "my-profile"] as const,
    profilePhoto: (objectPath: string | null) => ["recruitment", "profile-photo", objectPath] as const,
    profileDocuments: () => ["recruitment", "profile-documents"] as const,
    myApplications: (filters: Record<string, unknown>) =>
      ["recruitment", "my-applications", filters] as const,
    applicationForJob: (jobId: number) => ["recruitment", "application-for-job", jobId] as const,
    application: (applicationId: string) =>
      ["recruitment", "application", applicationId] as const,
    hrJobs: (filters: Record<string, unknown>) =>
      ["recruitment", "hr-jobs", filters] as const,
    applications: (filters: Record<string, unknown>) =>
      ["recruitment", "applications", filters] as const,
    aiScores: (applicationId: string) => ["recruitment", "ai-scores", applicationId] as const,
  },
  leaveManagement: {
    types: () => ["leave-management", "types"] as const,
    mine: (filters: Record<string, unknown>) => ["leave-management", "mine", filters] as const,
    request: (requestId: string) => ["leave-management", "request", requestId] as const,
    hrQueue: (filters: Record<string, unknown>) => ["leave-management", "hr-queue", filters] as const,
    attachment: (objectPath: string) => ["leave-management", "attachment", objectPath] as const,
  },
  deploymentTracking: {
    hrDirectory: (filters: Record<string, unknown>) => ["deployment-tracking", "hr-directory", filters] as const,
    mine: (filters: Record<string, unknown>) => ["deployment-tracking", "mine", filters] as const,
    detail: (deploymentId: string) => ["deployment-tracking", "detail", deploymentId] as const,
  },
  promotionEligibility: {
    criteria: (filters: Record<string, unknown> = {}) => ["promotion-eligibility", "criteria", filters] as const,
    hrDirectory: (filters: Record<string, unknown>) => ["promotion-eligibility", "hr-directory", filters] as const,
    hrEmployee: (employeeId: string) => ["promotion-eligibility", "hr-employee", employeeId] as const,
    mine: () => ["promotion-eligibility", "mine"] as const,
  },
  attendanceIntegration: {
    hrLogs: (filters: Record<string, unknown>) => ["attendance-integration", "hr-logs", filters] as const,
    mine: (filters: Record<string, unknown>) => ["attendance-integration", "mine", filters] as const,
    imports: (filters: Record<string, unknown>) => ["attendance-integration", "imports", filters] as const,
    unmatched: (filters: Record<string, unknown>) => ["attendance-integration", "unmatched", filters] as const,
    settings: () => ["attendance-integration", "settings"] as const,
  },
};
