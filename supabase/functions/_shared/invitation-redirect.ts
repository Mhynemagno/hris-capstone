export function getInvitationRedirectUrl(appUrl: string | undefined) {
  if (!appUrl) return null;

  try {
    const url = new URL(appUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return new URL("/auth/callback", url).toString();
  } catch {
    return null;
  }
}
