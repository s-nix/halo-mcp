import { randomUUID, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { Response } from "express";
import {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

// ─── In-memory stores ────────────────────────────────────────────────────────

interface AuthCode {
  code: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: number;
}

interface StoredToken {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

const clients = new Map<string, OAuthClientInformationFull>();
const authCodes = new Map<string, AuthCode>();
const accessTokens = new Map<string, StoredToken>();
const refreshTokens = new Map<string, StoredToken>();

// Pending authorization requests awaiting passphrase confirmation
export interface PendingAuth {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  expiresAt: number;
}

export const pendingAuths = new Map<string, PendingAuth>();

// ─── Client Store ────────────────────────────────────────────────────────────

class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return clients.get(clientId);
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
  ): OAuthClientInformationFull {
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    clients.set(full.client_id, full);
    return full;
  }
}

// ─── OAuth Provider ──────────────────────────────────────────────────────────

export class HaloOAuthProvider implements OAuthServerProvider {
  get clientsStore(): OAuthRegisteredClientsStore {
    return new InMemoryClientsStore();
  }

  /**
   * The authorize endpoint. If MCP_AUTH_PASSPHRASE is set, renders an HTML
   * form requiring the passphrase before issuing an authorization code.
   * Otherwise, auto-approves (original behavior).
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const passphrase = process.env.MCP_AUTH_PASSPHRASE;

    if (!passphrase) {
      // No passphrase configured — auto-approve (legacy behavior)
      this.issueCodeAndRedirect(client.client_id, params, res);
      return;
    }

    // Store the pending authorization and show the login form
    const requestId = randomUUID();
    pendingAuths.set(requestId, {
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? [],
      state: params.state,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    res.setHeader("Content-Type", "text/html");
    res.send(renderLoginPage(requestId));
  }

  /**
   * Issue an authorization code and redirect the user back to the client.
   */
  issueCodeAndRedirect(
    clientId: string,
    params: { codeChallenge: string; redirectUri: string; scopes?: string[]; state?: string },
    res: Response
  ): void {
    const code = randomBytes(32).toString("base64url");

    authCodes.set(code, {
      code,
      clientId,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? [],
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    if (params.state) {
      redirectUrl.searchParams.set("state", params.state);
    }

    res.redirect(302, redirectUrl.toString());
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const stored = authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    return stored.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL
  ): Promise<OAuthTokens> {
    const stored = authCodes.get(authorizationCode);
    if (!stored) {
      throw new Error("Invalid authorization code");
    }
    if (stored.clientId !== client.client_id) {
      throw new Error("Client mismatch");
    }
    if (Date.now() > stored.expiresAt) {
      authCodes.delete(authorizationCode);
      throw new Error("Authorization code expired");
    }

    // Consume the code (one-time use)
    authCodes.delete(authorizationCode);

    const accessToken = randomBytes(32).toString("base64url");
    const refreshToken = randomBytes(32).toString("base64url");
    const expiresIn = 3600; // 1 hour

    accessTokens.set(hashToken(accessToken), {
      token: accessToken,
      clientId: client.client_id,
      scopes: stored.scopes,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    refreshTokens.set(hashToken(refreshToken), {
      token: refreshToken,
      clientId: client.client_id,
      scopes: stored.scopes,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: refreshToken,
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    _resource?: URL
  ): Promise<OAuthTokens> {
    const hash = hashToken(refreshToken);
    const stored = refreshTokens.get(hash);
    if (!stored) {
      throw new Error("Invalid refresh token");
    }
    if (stored.clientId !== client.client_id) {
      throw new Error("Client mismatch");
    }
    if (Date.now() > stored.expiresAt) {
      refreshTokens.delete(hash);
      throw new Error("Refresh token expired");
    }

    // Rotate refresh token
    refreshTokens.delete(hash);

    const newAccessToken = randomBytes(32).toString("base64url");
    const newRefreshToken = randomBytes(32).toString("base64url");
    const expiresIn = 3600;

    const resolvedScopes = scopes ?? stored.scopes;

    accessTokens.set(hashToken(newAccessToken), {
      token: newAccessToken,
      clientId: client.client_id,
      scopes: resolvedScopes,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    refreshTokens.set(hashToken(newRefreshToken), {
      token: newRefreshToken,
      clientId: client.client_id,
      scopes: resolvedScopes,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return {
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      refresh_token: newRefreshToken,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const hash = hashToken(token);
    const stored = accessTokens.get(hash);
    if (!stored) {
      throw new Error("Invalid access token");
    }
    if (Date.now() > stored.expiresAt) {
      accessTokens.delete(hash);
      throw new Error("Access token expired");
    }

    return {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: Math.floor(stored.expiresAt / 1000),
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ): Promise<void> {
    const hash = hashToken(request.token);
    accessTokens.delete(hash);
    refreshTokens.delete(hash);
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Passphrase helpers ──────────────────────────────────────────────────────

export function verifyPassphrase(input: string): boolean {
  const expected = process.env.MCP_AUTH_PASSPHRASE ?? "";
  const bufA = Buffer.from(input, "utf-8");
  const bufB = Buffer.from(expected, "utf-8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function renderLoginPage(requestId: string, error?: string): string {
  const errorHtml = error
    ? `<p style="color:#e74c3c;margin-bottom:1rem;">${error}</p>`
    : "";

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
    label { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; }
    input[type="password"] { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    button { margin-top: 1rem; width: 100%; padding: 0.6rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize MCP Connection</h1>
    ${errorHtml}
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
