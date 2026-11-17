/**
 * Returns the URL that chat messages for an agent card are sent to, or "" if the card names none.
 *
 * Reads it the same way the bundled a2a-editor does: the top-level `url` (A2A 0.x cards),
 * otherwise the first entry of `supportedInterfaces` (A2A 1.0 cards).
 */
export function agentEndpoint(card: unknown): string {
  if (!card || typeof card !== "object") return "";
  const { url, supportedInterfaces } = card as { url?: unknown; supportedInterfaces?: unknown };
  if (typeof url === "string" && url) return url;
  if (Array.isArray(supportedInterfaces)) {
    const first: unknown = supportedInterfaces[0];
    const interfaceUrl = first && typeof first === "object" ? (first as { url?: unknown }).url : undefined;
    if (typeof interfaceUrl === "string" && interfaceUrl) return interfaceUrl;
  }
  return "";
}

/** Same as {@link agentEndpoint}, for raw agent card JSON. Returns "" for invalid JSON. */
export function agentEndpointFromJson(json: string): string {
  try {
    return agentEndpoint(JSON.parse(json));
  } catch {
    return "";
  }
}
