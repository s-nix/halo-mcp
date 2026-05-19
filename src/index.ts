import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { randomUUID } from "node:crypto";
import express from "express";
import { HaloClient } from "./halo-client.js";
import { apiKeyAuth } from "./auth.js";
import { HaloOAuthProvider } from "./oauth-provider.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerClientTools } from "./tools/clients.js";
import { registerUserTools } from "./tools/users.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerAgentTools } from "./tools/agents.js";
import { registerKBTools } from "./tools/kb.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerSiteTools } from "./tools/sites.js";
import { registerOpportunityTools } from "./tools/opportunities.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const baseUrl = requireEnv("HALO_BASE_URL");
const clientId = requireEnv("HALO_CLIENT_ID");
const clientSecret = requireEnv("HALO_CLIENT_SECRET");
const scope = process.env.HALO_SCOPE ?? "all";

const halo = new HaloClient(baseUrl, clientId, clientSecret, scope);

const server = new McpServer({
  name: "halo-mcp",
  version: "1.0.0",
});

// Register all tool modules
registerTicketTools(server, halo);
registerClientTools(server, halo);
registerUserTools(server, halo);
registerAssetTools(server, halo);
registerAgentTools(server, halo);
registerKBTools(server, halo);
registerProjectTools(server, halo);
registerInvoiceTools(server, halo);
registerSiteTools(server, halo);
registerOpportunityTools(server, halo);

async function startStdio() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HaloPSA MCP server running on stdio");
}

async function startHttp() {
  const port = parseInt(process.env.MCP_PORT ?? "3000", 10);
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const authMode = process.env.MCP_AUTH_MODE ?? "apikey"; // "apikey" or "oauth"

  const app = express();
  app.use(express.json());

  // Health check (unauthenticated)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // OAuth provider for token verification
  const oauthProvider = new HaloOAuthProvider();

  if (authMode === "oauth") {
    // Mount the full OAuth router at the app root (handles /.well-known/*, /authorize, /token, /register)
    const issuerUrl = new URL(process.env.MCP_ISSUER_URL ?? `http://${host}:${port}`);
    app.use(
      mcpAuthRouter({
        provider: oauthProvider,
        issuerUrl,
        scopesSupported: ["mcp:read", "mcp:write"],
      })
    );
  }

  // Map of session transports for stateful mode
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Auth middleware for the MCP endpoint
  const mcpAuth = authMode === "oauth"
    ? async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          res.status(401).json({ error: "Missing Bearer token" });
          return;
        }
        try {
          const token = authHeader.slice(7);
          await oauthProvider.verifyAccessToken(token);
          next();
        } catch {
          res.status(401).json({ error: "Invalid or expired token" });
        }
      }
    : apiKeyAuth;

  app.use("/mcp", mcpAuth);

  app.all("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Existing session
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (sessionId && !transports.has(sessionId)) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // New session — create transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) transports.delete(id);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    const id = transport.sessionId;
    if (id) transports.set(id, transport);
  });

  app.listen(port, host, () => {
    console.error(`HaloPSA MCP server listening on http://${host}:${port}/mcp (auth: ${authMode})`);
  });
}

async function main() {
  const transport = process.env.MCP_TRANSPORT ?? "stdio";

  if (transport === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error("Fatal error starting HaloPSA MCP server:", error);
  process.exit(1);
});
