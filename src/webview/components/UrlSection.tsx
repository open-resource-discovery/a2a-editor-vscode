import { useState, useRef, useCallback, useEffect } from "react";
import { PasswordInput } from "./PasswordInput";
import { fetchAgentCard } from "../lib/fetchAgentCard";
import { friendlyError } from "../lib/friendlyError";
import { buildAuthHeaders, type AuthType } from "../lib/buildAuthHeaders";

interface UrlSectionProps {
  onConnect: (json: string, url: string, authHeaders?: Record<string, string>) => void;
  onError: (message: string) => void;
  clearError: () => void;
  externalUrl?: string | null;
}

export function UrlSection({ onConnect, onError, clearError, externalUrl }: UrlSectionProps) {
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount: abort in-flight fetch and clear timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Sync externally-set URL (e.g. from Copilot tools)
  useEffect(() => {
    if (externalUrl) {
      setUrl(externalUrl);
    }
  }, [externalUrl]);

  const handleConnect = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
      return;
    }

    clearError();

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      onError("Please enter a URL");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    timeoutRef.current = setTimeout(() => {
      controller.abort();
    }, 15000);

    const headers = buildAuthHeaders(authType, username, password, token, apiKey);

    fetchAgentCard(trimmedUrl, headers, controller.signal)
      .then((text) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        try {
          JSON.parse(text);
        } catch {
          throw new Error("Response is not valid JSON");
        }
        onConnect(text, trimmedUrl, Object.keys(headers).length ? headers : undefined);
        abortRef.current = null;
        setLoading(false);
      })
      .catch((err) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (err.name !== "AbortError") {
          onError(friendlyError(err, trimmedUrl));
        }
        abortRef.current = null;
        setLoading(false);
      });
  }, [url, authType, username, password, token, apiKey, onConnect, onError, clearError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConnect();
      }
    },
    [handleConnect],
  );

  return (
    <>
      <div className="sw-field">
        <label className="sw-label" htmlFor="sw-agent-url">
          Agent URL
        </label>
        <input
          type="text"
          className="sw-input"
          id="sw-agent-url"
          placeholder="https://example.com/.well-known/agent.json"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="sw-field">
        <label className="sw-label" htmlFor="sw-auth-type">
          Authentication
        </label>
        <select
          className="sw-select"
          id="sw-auth-type"
          value={authType}
          onChange={(e) => setAuthType(e.target.value as AuthType)}>
          <option value="none">No Authentication</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="apiKey">API Key</option>
        </select>
      </div>
      {authType === "basic" && (
        <div className="sw-field">
          <div className="sw-field">
            <label className="sw-label" htmlFor="sw-username">
              Username
            </label>
            <input
              type="text"
              className="sw-input"
              id="sw-username"
              placeholder="Username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="sw-field">
            <label className="sw-label" htmlFor="sw-password">
              Password
            </label>
            <PasswordInput
              id="sw-password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      )}
      {authType === "bearer" && (
        <div className="sw-field">
          <label className="sw-label" htmlFor="sw-token">
            Bearer Token
          </label>
          <PasswordInput
            id="sw-token"
            placeholder="Bearer Token"
            value={token}
            onChange={setToken}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
      {authType === "apiKey" && (
        <div className="sw-field">
          <label className="sw-label" htmlFor="sw-apikey">
            API Key
          </label>
          <PasswordInput
            id="sw-apikey"
            placeholder="API Key"
            value={apiKey}
            onChange={setApiKey}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
      <button className="sw-btn sw-btn-primary" onClick={handleConnect}>
        {loading ? <span>{"\u2717 Cancel"}</span> : <span>{"\u26A1 Connect"}</span>}
      </button>
    </>
  );
}
