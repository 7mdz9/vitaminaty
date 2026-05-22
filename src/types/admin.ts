export type AdminRole = "admin";

export interface AdminUserRecord {
  id: string;
  email: string;
  role: AdminRole;
  // TODO(M2): Add MFA enrollment and admin status fields once auth schema lands.
}
