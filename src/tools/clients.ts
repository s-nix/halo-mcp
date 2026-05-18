import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerClientTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_clients",
    "Search and list clients (customers/organizations) in HaloPSA. Returns paginated results.",
    {
      search: z.string().optional().describe("Search string to filter clients by name"),
      toplevel_id: z.number().optional().describe("Filter by top-level client ID"),
      includeactive: z.boolean().optional().describe("Include active clients (default: true)"),
      includeinactive: z.boolean().optional().describe("Include inactive clients (default: false)"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Client", {
        search: params.search,
        toplevel_id: params.toplevel_id,
        includeactive: params.includeactive ?? true,
        includeinactive: params.includeinactive ?? false,
        order: params.order,
        orderdesc: params.orderdesc,
        pageinate: true,
        page_no: params.page_no ?? 1,
        page_size: params.page_size ?? 50,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_client",
    "Get a single client/organization by ID with full details.",
    {
      id: z.number().describe("The client ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
    },
    async (params) => {
      const result = await halo.get(`/Client/${params.id}`, {
        includedetails: params.includedetails ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
