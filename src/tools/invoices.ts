import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HaloClient } from "../halo-client.js";

export function registerInvoiceTools(server: McpServer, halo: HaloClient): void {
  server.tool(
    "search_invoices",
    "Search and list invoices in HaloPSA.",
    {
      search: z.string().optional().describe("Search string to filter invoices"),
      client_id: z.number().optional().describe("Filter by client ID"),
      status_id: z.number().optional().describe("Filter by invoice status ID"),
      startdate: z.string().optional().describe("Filter invoices from this date (YYYY-MM-DD)"),
      enddate: z.string().optional().describe("Filter invoices before this date (YYYY-MM-DD)"),
      posted_only: z.boolean().optional().describe("Only return posted invoices"),
      order: z.string().optional().describe("Field to order by"),
      orderdesc: z.boolean().optional().describe("Order descending"),
      page_no: z.number().optional().describe("Page number (default: 1)"),
      page_size: z.number().optional().describe("Page size (default: 50)"),
    },
    async (params) => {
      const result = await halo.get("/Invoice", {
        search: params.search,
        client_id: params.client_id,
        status_id: params.status_id,
        startdate: params.startdate,
        enddate: params.enddate,
        posted_only: params.posted_only,
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
    "get_invoice",
    "Get a single invoice by ID with full details including line items.",
    {
      id: z.number().describe("The invoice ID"),
      includedetails: z.boolean().optional().describe("Include extra detail objects (default: true)"),
      includelinedetails: z.boolean().optional().describe("Include invoice line item details (default: true)"),
    },
    async (params) => {
      const result = await halo.get(`/Invoice/${params.id}`, {
        includedetails: params.includedetails ?? true,
        includelinedetails: params.includelinedetails ?? true,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
