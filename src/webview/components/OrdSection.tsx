import { useState, useRef, useCallback, useEffect } from "react";
import { AuthFields, EMPTY_AUTH, authHeaders, type AuthState } from "./AuthFields";
import { friendlyError } from "../lib/friendlyError";
import { hostRequest } from "../lib/hostRequest";
import { agentEndpointFromJson } from "../../shared/agentEndpoint";
import {
  headersForUrl,
  type OrdAgent,
  type OrdDiscoveryResult,
  type OrdDocumentFailure,
} from "../../shared/discoverOrdAgents";

const DISCOVERY_TIMEOUT_MS = 30000;
const CARD_TIMEOUT_MS = 15000;

interface OrdSectionProps {
  onSelect: (json: string, cardUrl: string, authHeaders: Record<string, string>) => void;
  onError: (message: string) => void;
  clearError: () => void;
}

interface Discovery extends OrdDiscoveryResult {
  /** Auth headers used for this discovery, reused when loading its agents */
  headers: Record<string, string>;
}

function describeFailure(failure: OrdDocumentFailure): string {
  let path = failure.url;
  try {
    path = new URL(failure.url).pathname;
  } catch {
    // keep the full URL
  }
  const needsAuth = failure.accessStrategies.length > 0 && !failure.accessStrategies.includes("open");
  return `${path}: ${failure.error}${needsAuth ? ` (access strategy: ${failure.accessStrategies.join(", ")})` : ""}`;
}

/** What is in flight: the discovery itself, or the agent card with this URL */
type Pending = { kind: "discover" } | { kind: "card"; cardUrl: string } | null;

export function OrdSection({ onSelect, onError, clearError }: OrdSectionProps) {
  const [endpoint, setEndpoint] = useState("");
  const [auth, setAuth] = useState<AuthState>(EMPTY_AUTH);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [selectedCardUrl, setSelectedCardUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight request on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Runs one request at a time. Starting a new one cancels the previous one. */
  const run = useCallback(
    async <T,>(
      next: NonNullable<Pending>,
      timeoutMs: number,
      label: string,
      url: string,
      task: (signal: AbortSignal) => Promise<T>,
    ): Promise<T | undefined> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPending(next);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        return await task(controller.signal);
      } catch (err) {
        if (timedOut) {
          onError(`${label} timed out after ${timeoutMs / 1000} seconds`);
        } else if ((err as Error).name !== "AbortError") {
          onError(friendlyError(err as Error, url));
        }
        return undefined;
      } finally {
        clearTimeout(timer);
        if (abortRef.current === controller) {
          abortRef.current = null;
          setPending(null);
        }
      }
    },
    [onError],
  );

  const handleDiscover = useCallback(async () => {
    if (pending?.kind === "discover") {
      abortRef.current?.abort();
      return;
    }
    clearError();
    const input = endpoint.trim();
    if (!input) {
      onError("Please enter an ORD endpoint URL");
      return;
    }
    const headers = authHeaders(auth);
    setDiscovery(null);
    setSelectedCardUrl(null);
    // Runs in the extension host: ORD providers often send no CORS headers, so the webview can't read them
    const result = await run({ kind: "discover" }, DISCOVERY_TIMEOUT_MS, "ORD discovery", input, (signal) =>
      hostRequest<OrdDiscoveryResult>("ordDiscover", { url: input, headers }, signal),
    );
    if (result) setDiscovery({ ...result, headers });
  }, [pending, endpoint, auth, run, onError, clearError]);

  const handleSelect = useCallback(
    async (agent: OrdAgent) => {
      if (!discovery) return;
      clearError();
      const { headers, trustedOrigins } = discovery;
      const json = await run(
        { kind: "card", cardUrl: agent.cardUrl },
        CARD_TIMEOUT_MS,
        "Loading the agent card",
        agent.cardUrl,
        (signal) =>
          hostRequest<string>(
            "ordFetchCard",
            { url: agent.cardUrl, headers: headersForUrl(agent.cardUrl, headers, trustedOrigins) },
            signal,
          ),
      );
      if (!json) return;
      setSelectedCardUrl(agent.cardUrl);
      // Chat goes to the card's endpoint, or to the card URL when it names none. Only pass the
      // credentials on if that target belongs to the ORD provider.
      const chatTarget = agentEndpointFromJson(json) || agent.cardUrl;
      onSelect(json, agent.cardUrl, headersForUrl(chatTarget, headers, trustedOrigins));
    },
    [discovery, run, onSelect, clearError],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleDiscover();
      }
    },
    [handleDiscover],
  );

  const agents = discovery?.agents ?? [];

  return (
    <>
      <p className="sw-hint">Discover A2A agents published through Open Resource Discovery (ORD).</p>
      <div className="sw-field">
        <label className="sw-label" htmlFor="sw-ord-url">
          ORD Endpoint
        </label>
        <input
          type="text"
          className="sw-input"
          id="sw-ord-url"
          placeholder="https://example.com/.well-known/open-resource-discovery"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <AuthFields idPrefix="sw-ord" value={auth} onChange={setAuth} onKeyDown={handleKeyDown} />
      <button className="sw-btn sw-btn-primary" onClick={() => void handleDiscover()}>
        {pending?.kind === "discover" ? <span>{"✗ Cancel"}</span> : <span>{"\u{1F50D} Discover Agents"}</span>}
      </button>
      {discovery && (
        <div className="sw-ord-results">
          {agents.length === 0 ? (
            <div className="sw-ord-empty">No A2A agents found in the ORD documents</div>
          ) : (
            <>
              <div className="sw-label">{agents.length === 1 ? "1 agent found" : `${agents.length} agents found`}</div>
              <ul className="sw-ord-list">
                {agents.map((agent) => {
                  const loading = pending?.kind === "card" && pending.cardUrl === agent.cardUrl;
                  const selected = selectedCardUrl === agent.cardUrl;
                  return (
                    <li key={agent.cardUrl}>
                      <button
                        type="button"
                        className={`sw-ord-agent ${selected ? "sw-active" : ""}`}
                        aria-pressed={selected}
                        title={agent.cardUrl}
                        onClick={() => void handleSelect(agent)}>
                        <span className="sw-ord-agent-title">{agent.title}</span>
                        {loading ? (
                          <span className="sw-ord-agent-desc">Loading agent card…</span>
                        ) : (
                          agent.description && <span className="sw-ord-agent-desc">{agent.description}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {discovery.failedDocuments.length > 0 && (
            <div className="sw-ord-failed" role="note">
              {discovery.failedDocuments.length === 1
                ? "1 ORD document could not be loaded:"
                : `${discovery.failedDocuments.length} ORD documents could not be loaded:`}
              <ul>
                {discovery.failedDocuments.map((failure) => (
                  <li key={failure.url} title={failure.url}>
                    {describeFailure(failure)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
