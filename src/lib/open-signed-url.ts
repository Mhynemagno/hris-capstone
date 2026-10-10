/**
 * Opens a signed file URL in one click. The tab is opened synchronously (inside the click),
 * so popup blockers allow it, then pointed at the URL once it resolves.
 */
export async function openSignedUrl(getUrl: () => Promise<string>) {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const url = await getUrl();
    if (tab) tab.location.href = url; else window.location.assign(url);
  } catch (cause) {
    tab?.close();
    throw cause;
  }
}
