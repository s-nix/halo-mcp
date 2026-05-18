import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerKBTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_kb_articles",
    "Search and list Knowledge Base articles in HaloPSA. Useful for finding documented solutions and procedures.",
    {
      search: z.string().optional().describe("Search string to filter KB articles"),
      client_id: z.number().optional().describe("Filter by client ID"),
      site_id: z.number().optional().describe("Filter by site ID"),
      type: z.number().optional().describe("Filter by article type"),
      faqlists: z.string().optional().describe("Filter by FAQ list IDs (comma-separated)"),
      includeactive: z.boolean().optional().describe("Include active articles (default: true)"),
      includeinactive: z.boolean().optional().describe("Include inactive articles (default: false)"),
      needsreview: z.string().optional().describe("Filter articles past their review date"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/KBArticle", {
        search: params.search,
        client_id: params.client_id,
        site_id: params.site_id,
        type: params.type,
        faqlists: params.faqlists,
        includeactive: params.includeactive ?? true,
        includeinactive: params.includeinactive ?? false,
        needsreview: params.needsreview,
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
    "get_kb_article",
    "Get a single Knowledge Base article by ID with full content.",
    {
      id: z.number().describe("The KB article ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
    },
    async (params) => {
      const result = await halo.get(`/KBArticle/${params.id}`, {
        includedetails: params.includedetails ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
