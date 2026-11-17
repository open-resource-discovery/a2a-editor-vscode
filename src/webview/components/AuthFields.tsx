import { PasswordInput } from "./PasswordInput";
import { buildAuthHeaders, type AuthType } from "../lib/buildAuthHeaders";

export interface AuthState {
  type: AuthType;
  username: string;
  password: string;
  token: string;
  apiKey: string;
}

export const EMPTY_AUTH: AuthState = { type: "none", username: "", password: "", token: "", apiKey: "" };

export function authHeaders(auth: AuthState): Record<string, string> {
  return buildAuthHeaders(auth.type, auth.username, auth.password, auth.token, auth.apiKey);
}

interface AuthFieldsProps {
  /** Prefix for element IDs, so several instances can coexist */
  idPrefix: string;
  value: AuthState;
  onChange: (value: AuthState) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function AuthFields({ idPrefix, value, onChange, onKeyDown }: AuthFieldsProps) {
  const set = (patch: Partial<AuthState>) => onChange({ ...value, ...patch });

  return (
    <>
      <div className="sw-field">
        <label className="sw-label" htmlFor={`${idPrefix}-auth-type`}>
          Authentication
        </label>
        <select
          className="sw-select"
          id={`${idPrefix}-auth-type`}
          value={value.type}
          onChange={(e) => set({ type: e.target.value as AuthType })}>
          <option value="none">No Authentication</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="apiKey">API Key</option>
        </select>
      </div>
      {value.type === "basic" && (
        <div className="sw-field">
          <div className="sw-field">
            <label className="sw-label" htmlFor={`${idPrefix}-username`}>
              Username
            </label>
            <input
              type="text"
              className="sw-input"
              id={`${idPrefix}-username`}
              placeholder="Username"
              autoComplete="off"
              value={value.username}
              onChange={(e) => set({ username: e.target.value })}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className="sw-field">
            <label className="sw-label" htmlFor={`${idPrefix}-password`}>
              Password
            </label>
            <PasswordInput
              id={`${idPrefix}-password`}
              placeholder="Password"
              value={value.password}
              onChange={(password) => set({ password })}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
      )}
      {value.type === "bearer" && (
        <div className="sw-field">
          <label className="sw-label" htmlFor={`${idPrefix}-token`}>
            Bearer Token
          </label>
          <PasswordInput
            id={`${idPrefix}-token`}
            placeholder="Bearer Token"
            value={value.token}
            onChange={(token) => set({ token })}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
      {value.type === "apiKey" && (
        <div className="sw-field">
          <label className="sw-label" htmlFor={`${idPrefix}-apikey`}>
            API Key
          </label>
          <PasswordInput
            id={`${idPrefix}-apikey`}
            placeholder="API Key"
            value={value.apiKey}
            onChange={(apiKey) => set({ apiKey })}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
    </>
  );
}
