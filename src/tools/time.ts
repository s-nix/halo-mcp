import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerTimeTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "log_time",
    "Log time worked against a ticket. Creates an action/note on the ticket with the time entry.",
    {
      ticket_id: z.number().describe("The ticket ID to log time against"),
      minutes: z.number().describe("Time worked in minutes"),
      note: z.string().optional().describe("Description of the work performed"),
      agent_id: z.number().optional().describe("Agent ID who performed the work (defaults to authenticated agent)"),
      date: z.string().optional().describe("Date the work was performed (YYYY-MM-DD, defaults to today)"),
      outcome: z.string().optional().describe("Action outcome name (e.g. 'Private Note')"),
      outcome_id: z.number().optional().describe("Action outcome ID"),
      hiddenfromuser: z.boolean().optional().describe("Hide from end user (default: true for time entries)"),
    },
    async (params) => {
      const action: Record<string, unknown> = {
        ticket_id: params.ticket_id,
        timetaken: params.minutes,
        note: params.note ?? `Time logged: ${params.minutes} minutes`,
        who_agentid: params.agent_id,
        outcome: params.outcome,
        outcome_id: params.outcome_id,
        hiddenfromuser: params.hiddenfromuser ?? true,
      };
      if (params.date) {
        action.actiondate = params.date;
      }
      const body = Object.fromEntries(Object.entries(action).filter(([, v]) => v !== undefined));
      const result = await halo.post("/Actions", [body]);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
