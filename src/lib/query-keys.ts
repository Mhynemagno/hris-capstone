import type { AppRole } from "@/lib/types/roles";

export const queryKeys = {
  appShell: () => ["app-shell"] as const,
  roleLanding: (role: AppRole) => ["role-landing", role] as const,
  administration: {
    users: (filters: Record<string, unknown>) =>
      ["administration", "users", filters] as const,
    roles: () => ["administration", "roles"] as const,
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
    detail: (employeeId: string) => ["personnel-records", "detail", employeeId] as const,
    serviceHistory: (employeeId: string) => ["personnel-records", "service-history", employeeId] as const,
    qualifications: (employeeId: string) => ["personnel-records", "qualifications", employeeId] as const,
    certifications: (employeeId: string) => ["personnel-records", "certifications", employeeId] as const,
    training: (employeeId: string) => ["personnel-records", "training", employeeId] as const,
  },
};
