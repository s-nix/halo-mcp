import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerOpportunityTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_opportunities",
    "Search and list sales opportunities in HaloPSA. Opportunities track potential deals and their pipeline stages.",
    {
      search: z.string().optional().describe("Search string to filter opportunities"),
      client_id: z.number().optional().describe("Filter by client ID"),
      agent_id: z.number().optional().describe("Filter by assigned agent/salesperson ID"),
      status_id: z.number().optional().describe("Filter by status/stage ID"),
      open_only: z.boolean().optional().describe("Return only open opportunities (default: true)"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Opportunities", {
        search: params.search,
        client_id: params.client_id,
        agent_id: params.agent_id,
        status_id: params.status_id,
        open_only: params.open_only ?? true,
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
    "get_opportunity",
    "Get a single opportunity by ID with full details.",
    {
      id: z.number().describe("The opportunity ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
    },
    async (params) => {
      const result = await halo.get(`/Opportunities/${params.id}`, {
        includedetails: params.includedetails ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
