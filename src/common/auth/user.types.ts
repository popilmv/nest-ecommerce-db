export type AppRole = 'user' | 'admin';

export interface RequestUser {
  id: string;
  role: AppRole;
}
