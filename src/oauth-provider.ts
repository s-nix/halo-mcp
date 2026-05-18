import { randomUUID, randomBytes, createHash } from "node:crypto";
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
   * The authorize endpoint. Since this is a machine-to-machine server,
   * we auto-approve the request (no interactive login page needed).
   * Claude.ai sends the user here then expects a redirect back with a code.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const code = randomBytes(32).toString("base64url");

    authCodes.set(code, {
      code,
      clientId: client.client_id,
      codeChallenge: params.codeChallenge,
      redirectUri: params.redirectUri,
      scopes: params.scopes ?? [],
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
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
