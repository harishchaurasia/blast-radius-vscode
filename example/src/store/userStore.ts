let currentUser: { id: string; name: string } | null = null;

export function setUser(user: { id: string; name: string }): void {
  currentUser = user;
}

export function getUser(): { id: string; name: string } | null {
  return currentUser;
}
