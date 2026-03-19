/**
 * Task 5.1: Manage Conversation Context to Preserve Critical Information Across Long Interactions
 *
 * Key concepts tested:
 * - Progressive summarization risk: numerical values, dates, percentages get compressed to vague summaries
 * - "Lost in the middle" effect: info at beginning/end is reliable; middle sections may be omitted
 * - Tool results accumulate disproportionately (40+ fields when only 5 are relevant)
 * - Complete conversation history must be passed in each API request for coherence
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Anti-Pattern: Progressive Summarization Loses Critical Facts
// ============================================================
//
// ❌ BAD: summarizing everything including transactional facts
//   Original: "Customer Alice Johnson, CUST-12345, requested $89.99 refund for ORD-9987,
//              damaged item, delivery date 2026-03-10, account active since 2020"
//   Summary:  "Customer requested a refund for a damaged item"
//   Lost:     customer ID, exact amount, order ID, delivery date, account age
//
// → Later turns: Claude can't verify the refund amount, order ID is gone, date is missing

// ============================================================
// CORRECT: Persistent "Case Facts" Block
// ============================================================
//
// Extract transactional facts into a SEPARATE persistent block that is ALWAYS included
// in each prompt, outside the summarized conversation history:

interface CaseFacts {
  customer_id: string;
  customer_name: string;
  account_status: string;
  issues: Array<{
    order_id: string;
    amount: number;
    status: string;
    delivery_date: string;
    issue_type: string;
  }>;
  session_start: string;
}

function buildSystemWithCaseFacts(caseFacts: CaseFacts): string {
  return `You are a customer support agent.

## CASE FACTS (preserved — do not summarize or lose these values)
Customer: ${caseFacts.customer_name} (ID: ${caseFacts.customer_id})
Account status: ${caseFacts.account_status}
Session started: ${caseFacts.session_start}

Issues being handled:
${caseFacts.issues.map((i) =>
  `  - Order ${i.order_id}: $${i.amount} ${i.issue_type}, status: ${i.status}, ` +
  `delivered: ${i.delivery_date}`
).join("\n")}

## INSTRUCTIONS
Always reference the exact values from CASE FACTS when discussing orders or amounts.
Never guess or approximate transactional values.`;
}

// ============================================================
// Tool Output Trimming: Only Relevant Fields
// ============================================================
//
// Problem: order lookup returns 40+ fields but only 5 are relevant to a refund inquiry
// Accumulated in context: 10 order lookups × 40 fields = 400 field-values cluttering context

const REFUND_RELEVANT_FIELDS = ["order_id", "customer_id", "amount", "status", "delivery_date"];

function trimOrderForContext(rawOrderData: Record<string, unknown>): Record<string, unknown> {
  // ✅ Keep only fields relevant to the current task (refund processing)
  return Object.fromEntries(
    Object.entries(rawOrderData).filter(([key]) => REFUND_RELEVANT_FIELDS.includes(key))
  );
}

// Example:
// Raw: { order_id, customer_id, amount, status, delivery_date, warehouse_id, carrier_id,
//        package_weight, shipping_method, warehouse_location, created_by, last_modified_by,
//        internal_notes, cost_center, ... }
// Trimmed: { order_id, customer_id, amount, status, delivery_date }
// Context savings: ~87% reduction in this tool result's token footprint

// ============================================================
// Position-Aware Input Ordering: Mitigating "Lost in the Middle"
// ============================================================
//
// "Lost in the middle" effect: models reliably attend to beginning and end of long inputs
// Middle sections may receive reduced attention and be omitted from the response
//
// ✅ Mitigation strategies:
//
// 1. Key findings summary at the TOP of aggregated inputs
//    (Before the detailed results — ensures it's processed)
//
// 2. Explicit section headers for detailed results
//    (Helps model maintain orientation in long content)
//
// 3. Most critical information at beginning OR end, not buried in middle

function buildAggregatedInput(
  criticalSummary: string,
  detailedResults: Array<{ section: string; content: string }>
): string {
  return [
    // ✅ Critical summary FIRST — reliably attended to
    "## Key Findings Summary (CRITICAL — read first)",
    criticalSummary,
    "",
    // ✅ Detailed results with explicit headers — model stays oriented
    "## Detailed Results",
    ...detailedResults.map(
      (r) => `### ${r.section}\n${r.content}`
    ),
    // ✅ Action required LAST — also reliably attended to
    "## Action Required",
    "Based on the findings above, provide your assessment.",
  ].join("\n");
}

// ============================================================
// Subagent Output: Structured Data Not Verbose Prose
// ============================================================
//
// Problem: upstream subagents return verbose reasoning chains
// → Downstream agents with limited context budgets get filled with irrelevant prose
//
// ✅ Fix: modify upstream agents to return structured key facts
//
// ❌ BAD upstream output:
//   "I analyzed the order and found that the customer placed it on March 10, 2026.
//    The delivery was confirmed by the carrier. The item was a Blue Widget. Looking at
//    the refund policy, since it's within 30 days and the item was damaged as evidenced
//    by the customer's photo, it qualifies for a full refund of $89.99..."
//
// ✅ GOOD upstream output (structured):
//   { "order_id": "ORD-9987", "amount": 89.99, "status": "delivered",
//     "delivery_date": "2026-03-10", "refund_eligible": true,
//     "reason": "within_30_days_damaged" }

export async function runContextManagementDemo(): Promise<void> {
  console.log("\n=== Task 5.1: Context Management ===\n");

  const caseFacts: CaseFacts = {
    customer_id: "CUST-12345",
    customer_name: "Alice Johnson",
    account_status: "active",
    session_start: new Date().toISOString(),
    issues: [
      {
        order_id: "ORD-9987",
        amount: 89.99,
        status: "delivered",
        delivery_date: "2026-03-10",
        issue_type: "damaged",
      },
    ],
  };

  const rawOrder = {
    order_id: "ORD-9987",
    customer_id: "CUST-12345",
    amount: 89.99,
    status: "delivered",
    delivery_date: "2026-03-10",
    warehouse_id: "WH-07",
    carrier_id: "USPS",
    package_weight: "2.3kg",
    shipping_method: "standard",
    cost_center: "CC-042",
    internal_notes: "packed on 2026-03-08",
    last_modified_by: "system",
  };

  const trimmed = trimOrderForContext(rawOrder);
  console.log("Raw order fields:", Object.keys(rawOrder).length);
  console.log("Trimmed order fields:", Object.keys(trimmed).length);
  console.log("Trimmed:", trimmed);
  console.log();

  const system = buildSystemWithCaseFacts(caseFacts);
  console.log("System prompt includes case facts block:");
  console.log(system.split("\n").slice(0, 10).join("\n") + "\n...");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    system,
    messages: [
      { role: "user", content: "Can you process a refund for the damaged item?" },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  console.log("\nAgent:", text);
}

await runContextManagementDemo();
