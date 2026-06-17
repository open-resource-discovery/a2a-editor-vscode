// Shared tool definitions used by both the Copilot Language Model tools
// (src/tools.ts) and the bundled MCP server (src/mcp/server.ts). Keeping
// names, descriptions, and JSON Schemas in one place prevents drift between
// the two surfaces and the package.json `contributes.languageModelTools`
// declaration.

export interface ToolDef {
  name: string;
  displayName: string;
  description: string;
  inputSchema: {
    type: "object";
    required: string[];
    properties: Record<string, { type: string; description: string }>;
  };
}

export const FETCH_AGENT_CARD_TOOL: ToolDef = {
  name: "a2aAgentCard_fetchAgentCard",
  displayName: "Fetch A2A Agent Card",
  description:
    "Fetch an A2A agent card from a URL. Tries well-known paths (/.well-known/agent.json, /.well-known/agent-card.json) before falling back to the direct URL. Returns the full agent card JSON with a summary of the agent's name, endpoint, description, and skills.",
  inputSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: {
        type: "string",
        description: "The URL of the A2A agent or direct path to an agent card JSON file",
      },
    },
  },
};

export const VALIDATE_AGENT_CARD_TOOL: ToolDef = {
  name: "a2aAgentCard_validateAgentCard",
  displayName: "Validate A2A Agent Card",
  description:
    "Validate a JSON string as an A2A agent card. Checks for required fields (name, url) and reports present optional fields (skills, capabilities, provider, securitySchemes, etc.). Returns a validation summary including whether the card is valid, which fields are present or missing, and details about skills and capabilities.",
  inputSchema: {
    type: "object",
    required: ["content"],
    properties: {
      content: {
        type: "string",
        description: "The JSON string to validate as an A2A agent card",
      },
    },
  },
};

export const SEND_MESSAGE_TOOL: ToolDef = {
  name: "a2aAgentCard_sendMessage",
  displayName: "Send Message to A2A Agent",
  description:
    "Send a test message to an A2A agent using the JSON-RPC 2.0 message/send method. Posts the message to the agent's URL and returns the response. Use this to test if an A2A agent is responding correctly.",
  inputSchema: {
    type: "object",
    required: ["url", "message"],
    properties: {
      url: { type: "string", description: "The A2A agent endpoint URL to send the message to" },
      message: { type: "string", description: "The text message to send to the agent" },
    },
  },
};

export const TOOL_DEFS: ToolDef[] = [FETCH_AGENT_CARD_TOOL, VALIDATE_AGENT_CARD_TOOL, SEND_MESSAGE_TOOL];

// ---------------------------------------------------------------------------
// Validation logic (shared between LM tool and MCP handler)
// ---------------------------------------------------------------------------

export const REQUIRED_FIELDS = ["name", "url"] as const;
export const OPTIONAL_FIELDS = [
  "description",
  "provider",
  "version",
  "skills",
  "capabilities",
  "securitySchemes",
  "security",
  "defaultInputModes",
  "defaultOutputModes",
] as const;

export interface ValidateResult {
  valid: boolean;
  /** Lines of human-readable validation output, in display order. */
  lines: string[];
}

/** Pure validator. Does not touch the sidebar or any VS Code API. */
export function validateAgentCardText(content: string): ValidateResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    return {
      valid: false,
      lines: [`Invalid JSON: ${err instanceof Error ? err.message : err}`],
    };
  }

  const missing = REQUIRED_FIELDS.filter((f) => !(f in parsed));
  const present = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].filter((f) => f in parsed);
  const skills = parsed.skills as Array<Record<string, unknown>> | undefined;

  const lines: string[] = [];
  lines.push(missing.length === 0 ? "Valid: true" : "Valid: false");
  if (missing.length) lines.push(`Missing required fields: ${missing.join(", ")}`);
  lines.push(`Present fields: ${present.join(", ")}`);
  if (parsed.name) lines.push(`Name: ${parsed.name}`);
  if (parsed.url) lines.push(`Endpoint: ${parsed.url}`);
  if (skills?.length) {
    lines.push(`Skills (${skills.length}):`);
    for (const s of skills) {
      lines.push(`  - ${s.name}: ${s.description || "no description"}`);
    }
  }
  const caps = parsed.capabilities as Record<string, unknown> | undefined;
  if (caps) {
    lines.push(
      `Capabilities: streaming=${caps.streaming ?? false}, pushNotifications=${caps.pushNotifications ?? false}`,
    );
  }

  return { valid: missing.length === 0, lines };
}
