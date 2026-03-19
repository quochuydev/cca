/**
 * Task 1.4: Multi-Step Workflows with Enforcement and Handoff Patterns
 *
 * Key concepts tested:
 * - Programmatic prerequisite gates vs prompt-based guidance
 * - When deterministic compliance is required, prompts have a non-zero failure rate
 * - Blocking downstream tools until prerequisites complete (e.g., verify before refund)
 * - Decomposing multi-concern requests into parallel investigations
 * - Structured handoff summaries for human escalation
 *
 * Exam scenario: Production shows 12% of cases skip get_customer and call lookup_order
 * directly → fix is programmatic enforcement (Answer A), not better prompts (Answer B/C)
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Prerequisite Gate: Track workflow state
// The gate is enforced in tool execution code — not in prompts.
// ============================================================
interface WorkflowState {
  verified_customer_id: string | null;
  verified_customer_name: string | null;
  orders_looked_up: Set<string>;
}

const state: WorkflowState = {
  verified_customer_id: null,
  verified_customer_name: null,
  orders_looked_up: new Set(),
};

// ✅ CORRECT: Programmatic gate blocks downstream calls until prerequisite completes.
// This is deterministic — the gate CANNOT be skipped regardless of model reasoning.
function executeToolWithGate(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "get_customer": {
      // Prerequisite: none. This is the root gate.
      const customerId = "CUST-" + Math.floor(Math.random() * 90000 + 10000);
      state.verified_customer_id = customerId;
      state.verified_customer_name = "Alice Johnson";
      return JSON.stringify({
        customer_id: customerId,
        name: "Alice Johnson",
        email: input.identifier,
        verified: true,
      });
    }

    case "lookup_order": {
      // ✅ GATE: lookup_order is BLOCKED until get_customer has returned a verified ID
      if (!state.verified_customer_id) {
        return JSON.stringify({
          error: "PREREQUISITE_NOT_MET",
          message: "Customer identity must be verified via get_customer before looking up orders.",
          retryable: false,
        });
      }
      const orderId = input.order_id as string;
      state.orders_looked_up.add(orderId);
      return JSON.stringify({
        order_id: orderId,
        customer_id: state.verified_customer_id,
        amount: 89.99,
        status: "delivered",
        items: ["Blue Widget x1"],
      });
    }

    case "process_refund": {
      // ✅ GATE: process_refund is BLOCKED until get_customer AND lookup_order complete
      if (!state.verified_customer_id) {
        return JSON.stringify({
          error: "PREREQUISITE_NOT_MET",
          message: "Customer must be verified before processing refunds.",
          retryable: false,
        });
      }
      const orderId = input.order_id as string;
      if (!state.orders_looked_up.has(orderId)) {
        return JSON.stringify({
          error: "PREREQUISITE_NOT_MET",
          message: `Order ${orderId} must be looked up before processing a refund for it.`,
          retryable: false,
        });
      }
      const amount = input.amount as number;
      if (amount > 500) {
        // Programmatic business rule — not relying on Claude to remember the limit
        return JSON.stringify({
          error: "POLICY_VIOLATION",
          message: `Refund of $${amount} exceeds the $500 automated limit. Escalate to human.`,
          retryable: false,
        });
      }
      return JSON.stringify({
        success: true,
        refund_id: "REF-" + Date.now(),
        amount,
        status: "initiated",
      });
    }

    case "escalate_to_human": {
      // Structured handoff: human agent gets everything needed without the transcript
      const summary = input as {
        customer_id?: string;
        customer_name?: string;
        root_cause: string;
        refund_amount?: number;
        recommended_action: string;
      };
      console.log("\n[ESCALATION HANDOFF]");
      console.log("Customer ID:", summary.customer_id || state.verified_customer_id);
      console.log("Customer Name:", summary.customer_name || state.verified_customer_name);
      console.log("Root Cause:", summary.root_cause);
      console.log("Refund Amount:", summary.refund_amount);
      console.log("Recommended Action:", summary.recommended_action);
      return JSON.stringify({ escalated: true, ticket_id: "TKT-" + Date.now() });
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

// ============================================================
// Tools with gate-enforcing descriptions
// ============================================================
const tools: Anthropic.Tool[] = [
  {
    name: "get_customer",
    description:
      "REQUIRED FIRST STEP. Verify customer identity by email or phone. " +
      "Returns verified customer_id. lookup_order and process_refund are blocked until this completes.",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "Customer email or phone" },
      },
      required: ["identifier"],
    },
  },
  {
    name: "lookup_order",
    description:
      "Retrieve order details. Requires get_customer to have been called first. " +
      "Returns order status, items, amounts.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        customer_id: { type: "string" },
      },
      required: ["order_id", "customer_id"],
    },
  },
  {
    name: "process_refund",
    description:
      "Process a refund. Requires get_customer AND lookup_order to have run first. " +
      "Maximum $500. Amounts above $500 must use escalate_to_human instead.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        order_id: { type: "string" },
        amount: { type: "number" },
        reason: { type: "string" },
      },
      required: ["customer_id", "order_id", "amount", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate to human agent. Use when: refund > $500, policy is unclear, " +
      "customer requests human, or issue cannot be resolved. " +
      "Provide full structured summary — the human agent has NO access to this conversation.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
        customer_name: { type: "string" },
        root_cause: { type: "string" },
        refund_amount: { type: "number" },
        recommended_action: { type: "string" },
      },
      required: ["root_cause", "recommended_action"],
    },
  },
];

// ============================================================
// Multi-Concern Parallel Investigation
// Task 1.4: Decompose multi-concern requests, investigate in parallel
// ============================================================
export async function runWorkflowEnforcement(userMessage: string): Promise<void> {
  console.log("\n=== Task 1.4: Workflow Enforcement & Handoff ===");
  console.log(`User: ${userMessage}\n`);

  // Reset state for demo
  state.verified_customer_id = null;
  state.verified_customer_name = null;
  state.orders_looked_up.clear();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      tools,
      messages,
      system: `You are a customer support agent.

Workflow rules (enforced programmatically — violations will be rejected):
1. ALWAYS call get_customer first to verify identity
2. Only call lookup_order AFTER get_customer returns a verified customer_id
3. Only call process_refund AFTER lookup_order confirms the order
4. For multi-concern requests: investigate each concern, then synthesize one unified response
5. Escalate when: refund > $500, customer insists on human, or policy is unclear

For escalation, compile a complete handoff summary (customer ID, root cause, amount, recommended action).`,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      console.log(`\nAssistant: ${text}`);
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`  → ${block.name}(${JSON.stringify(block.input)})`);
          const result = executeToolWithGate(
            block.name,
            block.input as Record<string, unknown>
          );
          console.log(`  ← ${result}`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }
}

// Run example — multi-concern: identity verification + two order issues
await runWorkflowEnforcement(
  "Hi I'm alice@example.com. I have two issues: " +
  "my order ORD-11111 arrived damaged and I want a refund, " +
  "and my order ORD-22222 hasn't shipped yet. Can you help with both?"
);
