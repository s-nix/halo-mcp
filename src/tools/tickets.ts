import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerTicketTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_tickets",
    "Search and list tickets in HaloPSA. Returns paginated results. Use filters to narrow results.",
    {
      search: z.string().optional().describe("Search string to filter tickets by summary/details"),
      client_id: z.number().optional().describe("Filter by client ID"),
      agent_id: z.number().optional().describe("Filter by assigned agent ID"),
      status_id: z.number().optional().describe("Filter by status ID"),
      open_only: z.boolean().optional().describe("Return only open tickets (default: true)"),
      tickettype_id: z.number().optional().describe("Filter by ticket type ID"),
      priority_id: z.number().optional().describe("Filter by priority ID"),
      category_1: z.string().optional().describe("Filter by category 1 ID(s), comma-separated"),
      site_id: z.number().optional().describe("Filter by site ID"),
      user_id: z.number().optional().describe("Filter by user/contact ID (the requester)"),
      startdate: z.string().optional().describe("Filter tickets opened after this date (YYYY-MM-DD)"),
      enddate: z.string().optional().describe("Filter tickets opened before this date (YYYY-MM-DD)"),
      order: z.string().optional().describe("Field to order by (e.g. 'dateoccured', 'id')"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Tickets", {
        search: params.search,
        client_id: params.client_id,
        agent_id: params.agent_id,
        status_id: params.status_id,
        open_only: params.open_only ?? true,
        tickettype_id: params.tickettype_id,
        priority_id: params.priority_id,
        category_1: params.category_1,
        site_id: params.site_id,
        user_id: params.user_id,
        startdate: params.startdate,
        enddate: params.enddate,
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
    "get_ticket",
    "Get a single ticket by ID with full details including custom fields, SLA info, and linked objects.",
    {
      id: z.number().describe("The ticket ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
      includelastaction: z.boolean().optional().describe("Include the last action on the ticket"),
    },
    async (params) => {
      const result = await halo.get(`/Tickets/${params.id}`, {
        includedetails: params.includedetails ?? true,
        includelastaction: params.includelastaction,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_ticket_actions",
    "Get all actions (notes, replies, time entries) on a ticket. Actions are the history/timeline of a ticket.",
    {
      ticket_id: z.number().describe("The ticket ID to get actions for"),
      agent_only: z.boolean().optional().describe("Only show agent actions (exclude system actions)"),
      excludesys: z.boolean().optional().describe("Exclude system-generated actions"),
      excludeprivate: z.boolean().optional().describe("Exclude private/hidden actions"),
      count: z.number().optional().describe("Number of actions to return"),
      includeattachments: z.boolean().optional().describe("Include attachment details"),
      includehtmlnote: z.boolean().optional().describe("Include the full HTML note content (default: true)"),
    },
    async (params) => {
      const result = await halo.get("/Actions", {
        ticket_id: params.ticket_id,
        agentonly: params.agent_only,
        excludesys: params.excludesys,
        excludeprivate: params.excludeprivate,
        count: params.count,
        includeattachments: params.includeattachments,
        includehtmlnote: params.includehtmlnote ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
