import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { randomUUID } from "node:crypto";
import express from "express";
import { HaloClient } from "./halo-client.js";
import { apiKeyAuth } from "./auth.js";
import { HaloOAuthProvider, pendingAuths, verifyPassphrase } from "./oauth-provider.js";
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
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

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

    // Passphrase confirmation endpoint (form POST from the authorize page)
    app.post("/authorize-confirm", (req, res) => {
      const { request_id, passphrase } = req.body;

      if (!request_id || !passphrase) {
        res.status(400).send("Missing required fields");
        return;
      }

      const pending = pendingAuths.get(request_id);
      if (!pending) {
        res.status(400).send("Invalid or expired authorization request");
        return;
      }

      if (Date.now() > pending.expiresAt) {
        pendingAuths.delete(request_id);
        res.status(400).send("Authorization request expired");
        return;
      }

      if (!verifyPassphrase(passphrase)) {
        // Re-render the form with an error (keep the same request_id)
        res.setHeader("Content-Type", "text/html");
        res.status(403).send(renderConfirmError(request_id));
        return;
      }

      // Passphrase valid — issue the code and redirect
      pendingAuths.delete(request_id);
      oauthProvider.issueCodeAndRedirect(pending.clientId, pending, res);
    });
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

function renderConfirmError(requestId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Authorize — HaloPSA MCP</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 360px; width: 100%; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    .error { color: #e74c3c; margin-bottom: 1rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; }
    input[type="password"] { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    button { margin-top: 1rem; width: 100%; padding: 0.6rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize MCP Connection</h1>
    <p class="error">Incorrect passphrase. Please try again.</p>
    <form method="POST" action="/authorize-confirm">
      <input type="hidden" name="request_id" value="${requestId}">
      <label for="passphrase">Passphrase</label>
      <input type="password" id="passphrase" name="passphrase" required autofocus>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`;
}

main().catch((error) => {
  console.error("Fatal error starting HaloPSA MCP server:", error);
  process.exit(1);
});
