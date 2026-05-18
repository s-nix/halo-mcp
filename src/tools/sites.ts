import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerSiteTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_sites",
    "Search and list sites (locations/offices) in HaloPSA. Sites belong to clients and represent physical locations.",
    {
      search: z.string().optional().describe("Search string to filter sites"),
      client_id: z.number().optional().describe("Filter by client ID"),
      includeactive: z.boolean().optional().describe("Include active sites (default: true)"),
      includeinactive: z.boolean().optional().describe("Include inactive sites (default: false)"),
      includeaddress: z.boolean().optional().describe("Include site address details"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Site", {
        search: params.search,
        client_id: params.client_id,
        includeactive: params.includeactive ?? true,
        includeinactive: params.includeinactive ?? false,
        includeaddress: params.includeaddress,
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
    "get_site",
    "Get a single site by ID with full details.",
    {
      id: z.number().describe("The site ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
      includeactivity: z.boolean().optional().describe("Include site ticket activity"),
    },
    async (params) => {
      const result = await halo.get(`/Site/${params.id}`, {
        includedetails: params.includedetails ?? true,
        includeactivity: params.includeactivity,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
