import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerUserTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_users",
    "Search and list users (contacts/end-users) in HaloPSA. Users are the people who raise tickets.",
    {
      search: z.string().optional().describe("Search string to filter users by name or email"),
      client_id: z.number().optional().describe("Filter by client ID"),
      site_id: z.number().optional().describe("Filter by site ID"),
      department_id: z.number().optional().describe("Filter by department ID"),
      includeactive: z.boolean().optional().describe("Include active users (default: true)"),
      includeinactive: z.boolean().optional().describe("Include inactive users (default: false)"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Users", {
        search: params.search,
        client_id: params.client_id,
        site_id: params.site_id,
        department_id: params.department_id,
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
    "get_user",
    "Get a single user/contact by ID with full details.",
    {
      id: z.number().describe("The user ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
    },
    async (params) => {
      const result = await halo.get(`/Users/${params.id}`, {
        includedetails: params.includedetails ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
