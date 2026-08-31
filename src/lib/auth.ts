export const AUTH_COOKIE = "clinquery_session";

export function isAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

export function sessionToken(): string {
  const password = process.env.APP_PASSWORD?.trim();

  if (!password) {
    return "";
  }

  return btoa(`clinquery:${password}`);
}

export function isValidPassword(password: string): boolean {
  return password === process.env.APP_PASSWORD?.trim();
}

export function isValidSession(token: string | undefined): boolean {
  if (!isAuthEnabled()) {
    return true;
  }

  return Boolean(token) && token === sessionToken();
}
