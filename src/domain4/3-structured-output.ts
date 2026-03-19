/**
 * Task 4.3: Enforce Structured Output Using Tool Use and JSON Schemas
 *
 * Key concepts tested:
 * - tool_use + JSON schema = guaranteed schema-compliant output (eliminates syntax errors)
 * - tool_choice: "auto" | "any" | { type: "tool", name: "..." }
 * - Strict schemas eliminate syntax errors but NOT semantic errors (values don't sum, wrong fields)
 * - Nullable fields prevent hallucination when info is absent from source document
 * - enum + "other" + detail pattern for extensible categorization
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Extraction Tool with JSON Schema
// ============================================================

const extractInvoiceTool: Anthropic.Tool = {
  name: "extract_invoice",
  description: "Extract structured invoice data from document text.",
  input_schema: {
    type: "object",
    properties: {
      invoice_number: {
        type: "string",
        description: "Invoice or PO number",
      },
      vendor_name: {
        type: "string",
        description: "Name of the vendor or supplier",
      },
      // ✅ NULLABLE: source doc may not include a due date — use null, don't fabricate
      due_date: {
        type: ["string", "null"],
        description: "Payment due date in ISO 8601 format, or null if not specified",
      },
      total_amount: {
        type: "number",
        description: "Final invoice total in the document's currency",
      },
      currency: {
        type: "string",
        description: "ISO 4217 currency code (e.g. USD, EUR, GBP)",
      },
      // ✅ ENUM + "other" pattern: covers known categories + extensible for novel ones
      document_type: {
        type: "string",
        enum: ["invoice", "purchase_order", "receipt", "credit_note", "other"],
        description: "Type of financial document",
      },
      // ✅ "other" + detail field: when document_type is "other", explain here
      document_type_detail: {
        type: ["string", "null"],
        description: "Describe document type when document_type is 'other', otherwise null",
      },
      // ✅ "unclear" enum value for ambiguous cases (prevents forced false classification)
      payment_status: {
        type: "string",
        enum: ["paid", "unpaid", "partial", "overdue", "unclear"],
        description: "Payment status — use 'unclear' if not determinable from document",
      },
      // ✅ SELF-CORRECTION: extract both calculated and stated totals to detect discrepancies
      calculated_total: {
        type: ["number", "null"],
        description: "Sum of line items + tax if computable from the document, otherwise null",
      },
      conflict_detected: {
        type: "boolean",
        description: "True if calculated_total differs from total_amount by more than $0.01",
      },
    },
    required: [
      "invoice_number",
      "vendor_name",
      "total_amount",
      "currency",
      "document_type",
      "payment_status",
      "conflict_detected",
    ],
  },
};

// ============================================================
// tool_choice Options
// ============================================================

// tool_choice: "auto" — model decides whether to call a tool or return text
// Use when: normal agent operation; model may have enough info to answer in text
//
// tool_choice: "any" — model MUST call a tool (any from the list)
// Use when: you need structured output but have multiple schema options
//   Example: multiple document types, each with its own extraction tool
//   → tool_choice: "any" guarantees a tool call regardless of model preference
//
// tool_choice: { type: "tool", name: "extract_metadata" } — forced specific tool
// Use when: pipeline must ALWAYS run a specific step first (e.g., metadata before enrichment)

async function extractWithForcedTool(documentText: string): Promise<void> {
  // ✅ FORCED: always run extract_invoice first (ensures structured output every time)
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: [extractInvoiceTool],
    tool_choice: { type: "tool", name: "extract_invoice" },
    system:
      "Extract invoice data precisely. For missing fields, use null — never fabricate values. " +
      "Normalize informal amounts (e.g., 'two hundred dollars' → 200.00). " +
      "Calculate the total from line items if possible; set conflict_detected if it differs from stated total.",
    messages: [{ role: "user", content: documentText }],
  });

  // Extract structured data from tool_use response
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (toolUse) {
    const invoice = toolUse.input as Record<string, unknown>;
    console.log("Extracted invoice:", JSON.stringify(invoice, null, 2));

    // ✅ Semantic validation: schema guarantees structure but NOT correctness
    // conflict_detected flags when line items don't sum to stated total
    if (invoice.conflict_detected) {
      console.warn(
        `⚠️  Amount conflict: stated=${invoice.total_amount}, calculated=${invoice.calculated_total}`
      );
    }
    if (invoice.document_type === "other") {
      console.log(`Document type detail: ${invoice.document_type_detail}`);
    }
  }
}

// ============================================================
// tool_choice: "any" for Multiple Schema Options
// ============================================================

const extractContractTool: Anthropic.Tool = {
  name: "extract_contract",
  description: "Extract structured data from legal contracts.",
  input_schema: {
    type: "object",
    properties: {
      parties: { type: "array", items: { type: "string" } },
      effective_date: { type: ["string", "null"] },
      termination_date: { type: ["string", "null"] },
      contract_value: { type: ["number", "null"] },
    },
    required: ["parties"],
  },
};

async function extractUnknownDocumentType(documentText: string): Promise<void> {
  // ✅ tool_choice: "any" — model picks the right schema based on document content
  // Guarantees a tool call (not a text response) even when document type is ambiguous
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: [extractInvoiceTool, extractContractTool],
    tool_choice: { type: "any" },
    messages: [
      {
        role: "user",
        content: `Extract structured data from this document:\n${documentText}`,
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (toolUse) {
    console.log(`Used schema: ${toolUse.name}`);
    console.log("Data:", JSON.stringify(toolUse.input, null, 2));
  }
}

export async function runStructuredOutputDemo(): Promise<void> {
  console.log("\n=== Task 4.3: Structured Output via Tool Use ===\n");

  await extractWithForcedTool(`
INVOICE #INV-2026-003
Vendor: Acme Supplies Ltd.
Date: March 1, 2026

Line Items:
  - Widget Pro x10 @ $25.00 = $250.00
  - Shipping: $15.00

Subtotal: $265.00
Tax (10%): $26.50
TOTAL DUE: $290.00
Status: UNPAID
`);
}

await runStructuredOutputDemo();
