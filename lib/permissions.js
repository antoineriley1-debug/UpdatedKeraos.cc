// Permissions library. v1.5 default: any authenticated user can do anything.
// The role hooks are here so v2 can add granular Admin / Manager / User / Read-only.

// For v1.5 we keep it simple: signed in = full access.
// Pass user and (optionally) the task's Owner to allow ownership-based rules later.

export function canCreate(user) {
  return !!user && user.role !== 'readonly';
}

export function canEdit(user, ownerName) {
  if (!user) return false;
  if (user.role === 'readonly') return false;
  return true;
}

export function canClose(user, ownerName) {
  if (!user) return false;
  if (user.role === 'readonly') return false;
  return true;
}

export function canReopen(user) {
  if (!user) return false;
  if (user.role === 'readonly') return false;
  return true;
}

// Role labels for display
export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'User',
  readonly: 'Read-only',
};
