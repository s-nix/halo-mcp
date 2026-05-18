import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolRegistrar = (server: McpServer, client: HaloClient) => void;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class HaloClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(baseUrl: string, clientId: string, clientSecret: string, scope: string = "all") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scope = scope;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const tokenUrl = `${this.baseUrl}/auth/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: this.scope,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to authenticate with HaloPSA: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    // Expire 60 seconds early to avoid edge cases
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async get(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<unknown> {
    const token = await this.getToken();
    const url = new URL(`${this.baseUrl}/api${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HaloPSA API error (GET ${path}): ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async post(path: string, body: unknown): Promise<unknown> {
    const token = await this.getToken();
    const url = `${this.baseUrl}/api${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HaloPSA API error (POST ${path}): ${response.status} ${errorText}`);
    }

    return response.json();
  }

  async delete(path: string): Promise<void> {
    const token = await this.getToken();
    const url = `${this.baseUrl}/api${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HaloPSA API error (DELETE ${path}): ${response.status} ${errorText}`);
    }
  }
}
