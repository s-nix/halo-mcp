import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerProjectTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_projects",
    "Search and list projects in HaloPSA. Projects are used to track larger bodies of work.",
    {
      search: z.string().optional().describe("Search string to filter projects"),
      client_id: z.number().optional().describe("Filter by client ID"),
      agent_id: z.number().optional().describe("Filter by assigned agent ID"),
      status_id: z.number().optional().describe("Filter by status ID"),
      open_only: z.boolean().optional().describe("Return only open projects (default: true)"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Projects", {
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
    "get_project",
    "Get a single project by ID with full details.",
    {
      id: z.number().describe("The project ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
    },
    async (params) => {
      const result = await halo.get(`/Projects/${params.id}`, {
        includedetails: params.includedetails ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
