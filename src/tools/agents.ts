import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerAgentTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "list_agents",
    "List agents (technicians/staff) in HaloPSA. Agents are the people who work on tickets.",
    {
      search: z.string().optional().describe("Search string to filter agents by name"),
      department_id: z.number().optional().describe("Filter by department ID"),
      departments: z.string().optional().describe("Filter by multiple department IDs, comma-separated"),
      includeenabled: z.boolean().optional().describe("Include enabled/active agents (default: true)"),
      includedisabled: z.boolean().optional().describe("Include disabled/inactive agents (default: false)"),
      includeroles: z.boolean().optional().describe("Include agent roles in response"),
      includestatus: z.boolean().optional().describe("Include agent online status"),
      team_id: z.number().optional().describe("Filter by team ID"),
    },
    async (params) => {
      const result = await halo.get("/Agent", {
        search: params.search,
        department_id: params.department_id,
        departments: params.departments,
        includeenabled: params.includeenabled !== false ? "true" : undefined,
        includedisabled: params.includedisabled ? "true" : undefined,
        includeroles: params.includeroles,
        includestatus: params.includestatus,
        team_id: params.team_id,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_agent",
    "Get a single agent/technician by ID.",
    {
      id: z.number().describe("The agent ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
      includeroles: z.boolean().optional().describe("Include agent roles"),
    },
    async (params) => {
      const result = await halo.get(`/Agent/${params.id}`, {
        includedetails: params.includedetails ?? true,
        includeroles: params.includeroles,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
