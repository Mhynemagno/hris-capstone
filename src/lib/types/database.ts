import type { AppRole } from "./roles";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  assigned_at: string;
};
