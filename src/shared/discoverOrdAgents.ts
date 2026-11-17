/**
 * Discovers A2A agents published through Open Resource Discovery (ORD).
 * https://open-resource-discovery.org
 *
 * Follows the same rules as the ORD discovery in @open-resource-discovery/a2a-editor:
 * read the ORD configuration, fetch every ORD document it lists, and collect the
 * API resources that expose an A2A agent card.
 *
 * Runs in the extension host, not in the webview: ORD providers are usually read
 * server-to-server and often send no CORS headers, so a webview could not read them.
 */

export const ORD_WELL_KNOWN_PATH = "/.well-known/open-resource-discovery";

export interface OrdAgent {
  /** ORD ID of the API resource that exposes the agent */
  id: string;
  title: string;
  description: string;
  cardUrl: string;
}

export interface OrdDocumentFailure {
  url: string;
  error: string;
  /** Access strategies the ORD configuration lists for the document, e.g. "basic-auth" */
  accessStrategies: string[];
}

export interface OrdDiscoveryResult {
  agents: OrdAgent[];
  /** Origins of the ORD provider. Auth headers are only sent to these. */
  trustedOrigins: string[];
  /** ORD documents that could not be loaded. Agents they list are missing from `agents`. */
  failedDocuments: OrdDocumentFailure[];
}

interface ResourceDefinition {
  type?: string;
  customType?: string;
  url?: string;
}

interface ApiResource {
  ordId?: string;
  title?: string;
  shortDescription?: string;
  description?: string;
  apiProtocol?: string;
  resourceDefinitions?: ResourceDefinition[];
}

interface OrdDocument {
  apiResources?: ApiResource[];
  agents?: Array<{
    title?: string;
    shortDescription?: string;
    exposedApiResources?: Array<{ ordId?: string }>;
  }>;
}

interface OrdConfiguration {
  baseUrl?: string;
  openResourceDiscoveryV1?: {
    documents?: Array<{ url?: string; accessStrategies?: Array<{ type?: string }> }>;
  };
}

/** Accepts a provider base URL or a full ORD well-known URL and returns the ORD configuration URL. */
export function toOrdConfigUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  return trimmed.includes(ORD_WELL_KNOWN_PATH) ? trimmed : trimmed + ORD_WELL_KNOWN_PATH;
}

/** Returns the auth headers only when the URL belongs to one of the trusted origins. */
export function headersForUrl(
  url: string,
  headers: Record<string, string>,
  trustedOrigins: string[],
): Record<string, string> {
  try {
    return trustedOrigins.includes(new URL(url).origin) ? headers : {};
  } catch {
    return {};
  }
}

function resolveUrl(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return base.replace(/\/+$/, "") + (url.startsWith("/") ? "" : "/") + url;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** fetch() that names the URL in network errors and the status in HTTP errors. */
async function request(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Response> {
  let resp: Response;
  try {
    resp = await fetch(url, { headers, signal });
  } catch (err) {
    if (err instanceof TypeError) {
      // Network failure. Node puts the reason (DNS, TLS, refused, …) in `cause`.
      const cause = (err as { cause?: { code?: string; message?: string } }).cause;
      const detail = cause?.code || cause?.message;
      throw new Error("Could not connect to " + url + (detail ? " (" + detail + ")" : ""));
    }
    throw err;
  }
  if (!resp.ok) {
    throw new Error("HTTP " + resp.status + (resp.statusText ? ": " + resp.statusText : ""));
  }
  return resp;
}

async function fetchJson<T>(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<T> {
  const resp = await request(url, headers, signal);
  try {
    return (await resp.json()) as T;
  } catch {
    throw new Error("Response from " + url + " is not valid JSON");
  }
}

function findAgentCardUrl(apiResource: ApiResource): string | undefined {
  return apiResource.resourceDefinitions?.find(
    (rd) => rd.type === "a2a-agent-card" || rd.customType === "a2a:agent-card:v1",
  )?.url;
}

function agentsFromDocument(doc: OrdDocument, docOrigin: string): OrdAgent[] {
  const apiResources = doc.apiResources ?? [];
  const byOrdId = new Map(apiResources.filter((r) => r.ordId).map((r) => [r.ordId as string, r]));
  const agents: OrdAgent[] = [];

  const add = (apiResource: ApiResource, title: string | undefined, description: string | undefined) => {
    const cardUrl = findAgentCardUrl(apiResource);
    if (!cardUrl || !apiResource.ordId) return;
    agents.push({
      id: apiResource.ordId,
      title: title || apiResource.title || "Unknown Agent",
      description: description || apiResource.shortDescription || apiResource.description || "",
      cardUrl: resolveUrl(cardUrl, docOrigin),
    });
  };

  if (doc.agents && doc.agents.length > 0) {
    for (const agent of doc.agents) {
      const apiResource = agent.exposedApiResources
        ?.map((ref) => (ref.ordId ? byOrdId.get(ref.ordId) : undefined))
        .find((r) => r && findAgentCardUrl(r));
      if (apiResource) add(apiResource, agent.title, agent.shortDescription);
    }
  } else {
    // No agents[] in the document: fall back to API resources that use the A2A protocol
    for (const apiResource of apiResources) {
      if (apiResource.apiProtocol === "a2a") add(apiResource, apiResource.title, apiResource.shortDescription);
    }
  }
  return agents;
}

export async function discoverOrdAgents(
  input: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<OrdDiscoveryResult> {
  const configUrl = toOrdConfigUrl(input);
  let configOrigin: string;
  try {
    configOrigin = new URL(configUrl).origin;
  } catch {
    throw new Error("Invalid URL: " + input);
  }

  const config = await fetchJson<OrdConfiguration>(configUrl, headers, signal);
  const baseUrl = (config.baseUrl || configOrigin).replace(/\/+$/, "");
  const trustedOrigins = [configOrigin];
  try {
    const baseOrigin = new URL(baseUrl).origin;
    if (!trustedOrigins.includes(baseOrigin)) trustedOrigins.push(baseOrigin);
  } catch {
    throw new Error("ORD configuration has an invalid baseUrl: " + config.baseUrl);
  }

  const documents = (config.openResourceDiscoveryV1?.documents ?? [])
    .filter((d): d is typeof d & { url: string } => !!d.url)
    .map((d) => ({
      url: resolveUrl(d.url, baseUrl),
      accessStrategies: (d.accessStrategies ?? []).map((s) => s.type).filter((t): t is string => !!t),
    }));
  if (documents.length === 0) {
    throw new Error("No ORD documents found at this endpoint");
  }

  const results = await Promise.allSettled(
    documents.map(async ({ url }) => {
      const doc = await fetchJson<OrdDocument>(url, headersForUrl(url, headers, trustedOrigins), signal);
      return agentsFromDocument(doc, new URL(url).origin);
    }),
  );

  if (results.every((r) => r.status === "rejected")) {
    // Surface the first failure, e.g. an abort or an HTTP error on the documents
    throw (results[0] as PromiseRejectedResult).reason;
  }

  const failedDocuments: OrdDocumentFailure[] = [];
  const seen = new Set<string>();
  const agents: OrdAgent[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      failedDocuments.push({ ...documents[i], error: errorMessage(result.reason) });
      return;
    }
    for (const agent of result.value) {
      if (seen.has(agent.cardUrl)) continue;
      seen.add(agent.cardUrl);
      agents.push(agent);
    }
  });

  return { agents, trustedOrigins, failedDocuments };
}

/** Fetches an agent card found through ORD and returns its raw JSON. */
export async function fetchOrdAgentCard(
  cardUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<string> {
  const resp = await request(cardUrl, headers, signal);
  const json = await resp.text();
  try {
    JSON.parse(json);
  } catch {
    throw new Error("Agent card is not valid JSON");
  }
  return json;
}
