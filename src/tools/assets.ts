import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerAssetTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_assets",
    "Search and list assets (devices, hardware, software) in HaloPSA. Assets represent managed items.",
    {
      search: z.string().optional().describe("Search string to filter assets"),
      client_id: z.number().optional().describe("Filter by client ID"),
      site_id: z.number().optional().describe("Filter by site ID"),
      assettype_id: z.number().optional().describe("Filter by asset type ID"),
      assetgroup_id: z.number().optional().describe("Filter by asset group ID"),
      contract_id: z.number().optional().describe("Filter by contract ID"),
      user_id: z.number().optional().describe("Filter by assigned user ID"),
      username: z.string().optional().describe("Filter by assigned username"),
      includeactive: z.boolean().optional().describe("Include active assets (default: true)"),
      includeinactive: z.boolean().optional().describe("Include inactive assets (default: false)"),
      includeassetfields: z.boolean().optional().describe("Include asset custom fields (requires assettype_id)"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Asset", {
        search: params.search,
        client_id: params.client_id,
        site_id: params.site_id,
        assettype_id: params.assettype_id,
        assetgroup_id: params.assetgroup_id,
        contract_id: params.contract_id,
        user_id: params.user_id,
        username: params.username,
        includeactive: params.includeactive ?? true,
        includeinactive: params.includeinactive ?? false,
        includeassetfields: params.includeassetfields,
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
    "get_asset",
    "Get a single asset/device by ID with full details including custom fields and linked objects.",
    {
      id: z.number().describe("The asset ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
      includediagramdetails: z.boolean().optional().describe("Include diagram/topology details"),
      includeactivity: z.boolean().optional().describe("Include recent ticket activity"),
    },
    async (params) => {
      const result = await halo.get(`/Asset/${params.id}`, {
        includedetails: params.includedetails ?? true,
        includediagramdetails: params.includediagramdetails,
        includeactivity: params.includeactivity,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
