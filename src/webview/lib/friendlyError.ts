const STATUS_DESCRIPTIONS: Record<string, string> = {
  "400": "Bad Request",
  "401": "Unauthorized",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "408": "Request Timeout",
  "429": "Too Many Requests",
  "500": "Internal Server Error",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
};

export function friendlyError(err: Error, url: string): string {
  if (err.name === "AbortError") return "Request cancelled";
  if (err.name === "TimeoutError") return "Request timed out after 15 seconds";
  if (err instanceof TypeError) return "Could not connect to " + url;

  const msg = err.message || String(err);
  if (msg.startsWith("HTTP ")) {
    const match = msg.match(/^HTTP (\d+)/);
    if (match) {
      const code = match[1];
      const desc = STATUS_DESCRIPTIONS[code];
      if (desc) return "Server returned HTTP " + code + ": " + desc;
    }
    return "Server returned " + msg;
  }
  return msg || "Unknown error";
}
