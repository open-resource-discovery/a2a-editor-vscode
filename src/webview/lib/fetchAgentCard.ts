export function fetchAgentCard(
  targetUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<string> {
  try {
    new URL(targetUrl);
  } catch {
    return Promise.reject(new Error("Invalid URL: " + targetUrl));
  }

  const opts: RequestInit = { headers, signal };

  // If URL ends in .json, fetch directly — it's an explicit path
  if (targetUrl.endsWith(".json")) {
    return fetch(targetUrl, opts).then((resp) => {
      if (!resp.ok) throw new Error("HTTP " + resp.status + ": " + resp.statusText);
      return resp.text();
    });
  }

  const baseUrl = targetUrl.replace(/[/]$/, "");

  // Try well-known paths first, then fall back to the original URL
  return fetch(baseUrl + "/.well-known/agent.json", opts)
    .then((resp) => {
      if (!resp.ok) {
        return fetch(baseUrl + "/.well-known/agent-card.json", opts);
      }
      return resp;
    })
    .then((resp) => {
      if (!resp.ok) {
        // Well-known paths not found — try the original URL directly
        return fetch(targetUrl, opts);
      }
      return resp;
    })
    .then((resp) => {
      if (!resp.ok) throw new Error("HTTP " + resp.status + ": " + resp.statusText);
      return resp.text();
    });
}
