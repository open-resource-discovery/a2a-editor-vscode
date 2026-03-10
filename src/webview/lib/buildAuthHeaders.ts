export type AuthType = "none" | "basic" | "bearer" | "apiKey";

export function buildAuthHeaders(
  authType: AuthType,
  username: string,
  password: string,
  token: string,
  apiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (authType === "basic" && username) {
    const encoded = Array.from(new TextEncoder().encode(username + ":" + (password || "")), (b) =>
      String.fromCharCode(b),
    ).join("");
    headers["Authorization"] = "Basic " + btoa(encoded);
  } else if (authType === "bearer" && token) {
    headers["Authorization"] = "Bearer " + token;
  } else if (authType === "apiKey" && apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}
