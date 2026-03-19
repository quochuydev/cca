/**
 * Task 1.1: Agentic Loop for Autonomous Task Execution
 *
 * Key concepts tested:
 * - stop_reason "tool_use" → execute tools and continue
 * - stop_reason "end_turn"  → Claude is done, terminate
 * - Tool results appended to conversation history between iterations
 * - Claude drives tool selection (model-driven), not pre-configured sequences
 *
 * Anti-patterns to avoid (see comments below):
 * - Parsing natural language to detect loop termination
 * - Arbitrary iteration caps as the primary stopping mechanism
 * - Checking for assistant text content as a completion indicator
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// --- Tool Definitions ---
// Descriptions are the primary mechanism LLMs use for tool selection.
// Each tool clearly states its purpose, required inputs, and boundary conditions.
const tools: Anthropic.Tool[] = [
  {
    name: "get_customer",
    description:
      "Retrieve a verified customer record by email or phone number. " +
      "Returns a verified customer_id. MUST be called before lookup_order or process_refund. " +
      "Example queries: 'alice@example.com', '+1-555-0101'. " +
      "Do NOT use this to look up orders — use lookup_order for that.",
    input_schema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "Customer email address or phone number",
        },
      },
      required: ["identifier"],
    },
  },
  {
    name: "lookup_order",
    description:
      "Retrieve order details by order ID. Requires a verified customer_id from get_customer. " +
      "Returns order status, items, and amount. " +
      "Use this for order inquiries, NOT for customer identity lookup.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID (e.g. ORD-12345)" },
        customer_id: {
          type: "string",
          description: "Verified customer ID returned by get_customer",
        },
      },
      required: ["order_id", "customer_id"],
    },
  },
  {
    name: "process_refund",
    description:
      "Process a refund for a delivered order. Requires verified customer_id and order_id. " +
      "Maximum refund is $500; amounts above $500 must be escalated to a human agent.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        order_id: { type: "string" },
        amount: { type: "number", description: "Refund amount in USD (max $500)" },
        reason: { type: "string", description: "Reason for the refund" },
      },
      required: ["customer_id", "order_id", "amount", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate the case to a human agent when: customer explicitly requests it, " +
      "refund exceeds $500, policy is ambiguous, or resolution is not possible. " +
      "Include a complete structured summary for the human agent.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        reason: { type: "string", description: "Why escalation is needed" },
        summary: {
          type: "string",
          description: "Full context: customer details, issue, actions taken, recommended action",
        },
      },
      required: ["reason", "summary"],
    },
  },
];

// --- Simulated Tool Execution ---
function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_customer":
      return JSON.stringify({
        customer_id: "CUST-12345",
        name: "Alice Johnson",
        email: input.identifier,
        verified: true,
        account_status: "active",
      });

    case "lookup_order":
      return JSON.stringify({
        order_id: input.order_id,
        customer_id: input.customer_id,
        amount: 89.99,
        status: "delivered",
        items: ["Blue Widget x1"],
        delivery_date: "2026-03-10",
      });

    case "process_refund":
      return JSON.stringify({
        success: true,
        refund_id: "REF-98765",
        amount: input.amount,
        status: "initiated",
        estimated_days: 3,
      });

    case "escalate_to_human":
      console.log(`\n[ESCALATION] ${input.reason}`);
      console.log(`Summary: ${input.summary}`);
      return JSON.stringify({ escalated: true, ticket_id: "TKT-55555" });

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

// --- Agentic Loop ---
export async function runAgenticLoop(userMessage: string): Promise<void> {
  console.log("\n=== Task 1.1: Agentic Loop ===");
  console.log(`User: ${userMessage}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // ✅ CORRECT: Loop controlled by stop_reason — not by iteration count or text inspection
  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      tools,
      messages,
      system:
        "You are a customer support agent. Always call get_customer to verify identity " +
        "before any order or refund operation. Escalate when policy is unclear.",
    });

    console.log(`  [stop_reason: ${response.stop_reason}]`);

    // ✅ CORRECT: "end_turn" = Claude is done reasoning, terminate the loop
    if (response.stop_reason === "end_turn") {
      const finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      console.log(`\nAssistant: ${finalText}`);
      break;
    }

    // ❌ ANTI-PATTERN (never do this):
    // if (response.content.some(b => b.type === "text" && b.text.includes("I'm done"))) break;
    // if (iteration++ > 10) break;  // arbitrary cap as PRIMARY mechanism

    // ✅ CORRECT: "tool_use" = Claude wants to call tools, execute and continue
    if (response.stop_reason === "tool_use") {
      // Step 1: Append the full assistant response (including tool_use blocks) to history
      messages.push({ role: "assistant", content: response.content });

      // Step 2: Execute every requested tool
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`  → ${block.name}(${JSON.stringify(block.input)})`);
          const result = executeTool(block.name, block.input as Record<string, unknown>);
          console.log(`  ← ${result}`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Step 3: Append tool results as a user message — Claude reads them next iteration
      // ✅ CORRECT: All results in one user message (not separate turns)
      messages.push({ role: "user", content: toolResults });
    }
  }
}

// Run example
await runAgenticLoop(
  "Hi, I'm alice@example.com. I'd like a refund for order ORD-99887 — the widget arrived damaged."
);
