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
    "create_ticket",
    "Create a new ticket in HaloPSA. Returns the created ticket object.",
    {
      summary: z.string().describe("Ticket summary/subject"),
      details: z.string().optional().describe("Ticket description/details (HTML supported)"),
      tickettype_id: z.number().describe("Ticket type ID (e.g. 1=Incident, 2=Service Request)"),
      client_id: z.number().optional().describe("Client ID to associate the ticket with"),
      site_id: z.number().optional().describe("Site ID"),
      user_id: z.number().optional().describe("User/contact ID (the requester)"),
      agent_id: z.number().optional().describe("Agent ID to assign the ticket to"),
      priority_id: z.number().optional().describe("Priority ID"),
      status_id: z.number().optional().describe("Status ID (defaults to New)"),
      category_1: z.number().optional().describe("Category 1 ID"),
      category_2: z.number().optional().describe("Category 2 ID"),
      category_3: z.number().optional().describe("Category 3 ID"),
      impact: z.number().optional().describe("Impact level (1=High, 2=Medium, 3=Low, 4=Very Low)"),
      urgency: z.number().optional().describe("Urgency level (1=High, 2=Medium, 3=Low, 4=Very Low)"),
    },
    async (params) => {
      const ticket: Record<string, unknown> = {
        summary: params.summary,
        details: params.details,
        tickettype_id: params.tickettype_id,
        client_id: params.client_id,
        site_id: params.site_id,
        user_id: params.user_id,
        agent_id: params.agent_id,
        priority_id: params.priority_id,
        status_id: params.status_id,
        category_1: params.category_1,
        category_2: params.category_2,
        category_3: params.category_3,
        impact: params.impact,
        urgency: params.urgency,
      };
      // Remove undefined fields
      const body = Object.fromEntries(Object.entries(ticket).filter(([, v]) => v !== undefined));
      const result = await halo.post("/Tickets", [body]);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_ticket",
    "Update an existing ticket's fields. Only include fields you want to change.",
    {
      id: z.number().describe("The ticket ID to update"),
      summary: z.string().optional().describe("Updated summary/subject"),
      details: z.string().optional().describe("Updated details"),
      agent_id: z.number().optional().describe("Reassign to this agent ID"),
      status_id: z.number().optional().describe("Change status ID"),
      priority_id: z.number().optional().describe("Change priority ID"),
      category_1: z.number().optional().describe("Change category 1"),
      category_2: z.number().optional().describe("Change category 2"),
      category_3: z.number().optional().describe("Change category 3"),
      client_id: z.number().optional().describe("Change client"),
      user_id: z.number().optional().describe("Change requester"),
      site_id: z.number().optional().describe("Change site"),
      impact: z.number().optional().describe("Change impact (1-4)"),
      urgency: z.number().optional().describe("Change urgency (1-4)"),
    },
    async (params) => {
      const ticket: Record<string, unknown> = { id: params.id };
      if (params.summary !== undefined) ticket.summary = params.summary;
      if (params.details !== undefined) ticket.details = params.details;
      if (params.agent_id !== undefined) ticket.agent_id = params.agent_id;
      if (params.status_id !== undefined) ticket.status_id = params.status_id;
      if (params.priority_id !== undefined) ticket.priority_id = params.priority_id;
      if (params.category_1 !== undefined) ticket.category_1 = params.category_1;
      if (params.category_2 !== undefined) ticket.category_2 = params.category_2;
      if (params.category_3 !== undefined) ticket.category_3 = params.category_3;
      if (params.client_id !== undefined) ticket.client_id = params.client_id;
      if (params.user_id !== undefined) ticket.user_id = params.user_id;
      if (params.site_id !== undefined) ticket.site_id = params.site_id;
      if (params.impact !== undefined) ticket.impact = params.impact;
      if (params.urgency !== undefined) ticket.urgency = params.urgency;

      const result = await halo.post("/Tickets", [ticket]);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "add_ticket_action",
    "Add an action (note, reply, or time entry) to a ticket. This is how you add comments, send emails, or log work.",
    {
      ticket_id: z.number().describe("The ticket ID to add the action to"),
      note: z.string().describe("The action note content (HTML supported)"),
      outcome: z.string().optional().describe("The outcome/action type name (e.g. 'Private Note', 'Email Client')"),
      outcome_id: z.number().optional().describe("The outcome/action type ID"),
      timetaken: z.number().optional().describe("Time taken in minutes"),
      agent_id: z.number().optional().describe("Agent ID performing the action"),
      hiddenfromuser: z.boolean().optional().describe("Whether to hide this action from the end user (private note)"),
      sendemail: z.boolean().optional().describe("Whether to send an email notification"),
    },
    async (params) => {
      const action: Record<string, unknown> = {
        ticket_id: params.ticket_id,
        note: params.note,
        outcome: params.outcome,
        outcome_id: params.outcome_id,
        timetaken: params.timetaken,
        who_agentid: params.agent_id,
        hiddenfromuser: params.hiddenfromuser ?? false,
        sendemail: params.sendemail ?? false,
      };
      const body = Object.fromEntries(Object.entries(action).filter(([, v]) => v !== undefined));
      const result = await halo.post("/Actions", [body]);
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
