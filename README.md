# halo-mcp

MCP server for HaloPSA — provides Claude with first-class access to HaloPSA tickets, clients, assets, users, projects, invoices, and more.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A HaloPSA instance with API access enabled
- API credentials (Client ID & Client Secret) from your HaloPSA admin panel

## Node.js Setup

If you don't have Node.js installed, pick one of the following methods:

### Windows (winget)

```powershell
winget install OpenJS.NodeJS.LTS
```

### Windows (installer)

Download the LTS installer from https://nodejs.org/ and follow the prompts.

### macOS (Homebrew)

```bash
brew install node@22
```

### Linux (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Using nvm (recommended for managing multiple Node versions)

**Install nvm on macOS/Linux:**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Then restart your terminal or run `source ~/.bashrc` (or `~/.zshrc`).

**Install nvm on Windows (nvm-windows):**

Download the latest installer from https://github.com/coreybutler/nvm-windows/releases and run it. Alternatively, with winget:

```powershell
winget install CoreyButler.NVMforWindows
```

**Then install and use Node:**

```bash
nvm install 22
nvm use 22
```

Verify the installation:

```bash
node --version   # should print v18+ 
npm --version
```

## Installation

```bash
git clone <repo-url> && cd halo-mcp
npm install
```

## Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `HALO_BASE_URL` | Yes | Base URL of your HaloPSA instance (e.g. `https://h.example.com`) |
| `HALO_CLIENT_ID` | Yes | OAuth Client ID from HaloPSA |
| `HALO_CLIENT_SECRET` | Yes | OAuth Client Secret from HaloPSA |
| `HALO_SCOPE` | No | API scope (default: `all`) |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` |
| `MCP_HOST` | No | HTTP bind address (default: `127.0.0.1`) |
| `MCP_PORT` | No | HTTP port (default: `3000`) |
| `MCP_AUTH_MODE` | No | `apikey` (default) or `oauth` — applies to HTTP transport only |
| `MCP_API_KEY` | Cond. | Required when `MCP_AUTH_MODE=apikey` and using HTTP transport |
| `MCP_ISSUER_URL` | Cond. | Required when `MCP_AUTH_MODE=oauth` — your server's public HTTPS URL |

### Generating an API Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Building

```bash
npm run build
```

## Running the Server

### stdio transport (local / VS Code)

```bash
npm start
```

Or in development mode (no build step):

```bash
npm run dev
```

### HTTP transport (remote / Claude.ai)

```bash
npm run start:http
```

Or in development mode:

```bash
npm run dev:http
```

The server will listen on `http://<MCP_HOST>:<MCP_PORT>/mcp` (default `http://127.0.0.1:3000/mcp`).

A health-check endpoint is available at `GET /health` (unauthenticated).

## Reverse Proxy with Caddy (HTTPS)

When exposing the server publicly (e.g. for Claude.ai with OAuth), use [Caddy](https://caddyserver.com/) for automatic HTTPS.

### Installing Caddy

**Windows (winget):**

```powershell
winget install CaddyServer.Caddy
```

**macOS (Homebrew):**

```bash
brew install caddy
```

**Debian/Ubuntu:**

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

**Fedora/RHEL/CentOS:**

```bash
dnf install 'dnf-command(copr)'
dnf copr enable @caddy/caddy
dnf install caddy
```

### Caddyfile Configuration

Create a `Caddyfile` in the project root (or `/etc/caddy/Caddyfile`):

```caddyfile
your-domain.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy will automatically provision and renew TLS certificates via Let's Encrypt.

### Running Caddy

```bash
# Foreground (development)
caddy run

# Background (production)
caddy start

# With a specific Caddyfile
caddy run --config /path/to/Caddyfile
```

On Linux with systemd:

```bash
sudo systemctl enable --now caddy
```

### Matching .env to Caddy

When using Caddy as the public-facing proxy, set these in your `.env`:

```dotenv
MCP_TRANSPORT=http
MCP_HOST=127.0.0.1
MCP_PORT=3000
MCP_AUTH_MODE=oauth
MCP_ISSUER_URL=https://your-domain.example.com
```

The `MCP_ISSUER_URL` must match the domain in your Caddyfile so that OAuth discovery metadata resolves correctly.

## Authentication (HTTP transport)

### API Key mode (default)

Set `MCP_AUTH_MODE=apikey` and provide `MCP_API_KEY`. Clients authenticate with either:

- `Authorization: Bearer <key>` header
- `X-API-Key: <key>` header

### OAuth 2.1 mode

Set `MCP_AUTH_MODE=oauth` and `MCP_ISSUER_URL` to your server's public HTTPS URL. The server exposes standard OAuth endpoints:

- `GET /.well-known/oauth-authorization-server` — metadata
- `POST /register` — dynamic client registration
- `GET /authorize` — authorization endpoint
- `POST /token` — token endpoint

## Using with VS Code (Copilot)

Add the following to your VS Code `settings.json` or workspace `.vscode/settings.json`:

```jsonc
{
  "mcp": {
    "servers": {
      "halo-mcp": {
        "command": "node",
        "args": ["dist/index.js"],
        "cwd": "/path/to/halo-mcp",
        "env": {
          "HALO_BASE_URL": "https://h.example.com",
          "HALO_CLIENT_ID": "your-client-id",
          "HALO_CLIENT_SECRET": "your-client-secret"
        }
      }
    }
  }
}
```

Alternatively, keep credentials in the `.env` file and omit the `env` block — the server loads `dotenv` automatically.

## Available Tools

| Category | Tools |
|----------|-------|
| Tickets | `search_tickets`, `get_ticket`, `get_ticket_actions` |
| Clients | `search_clients`, `get_client` |
| Users | `search_users`, `get_user` |
| Assets | `search_assets`, `get_asset` |
| Agents | `list_agents`, `get_agent` |
| Knowledge Base | `search_kb_articles`, `get_kb_article` |
| Projects | `search_projects`, `get_project` |
| Invoices | `search_invoices`, `get_invoice` |
| Sites | `search_sites`, `get_site` |
| Opportunities | `search_opportunities`, `get_opportunity` |

## License

MIT
