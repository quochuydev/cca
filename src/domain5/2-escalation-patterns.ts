/**
 * Task 5.2: Design Effective Escalation and Ambiguity Resolution Patterns
 *
 * Key concepts tested:
 * - Escalation triggers: explicit human request, policy gaps (not just complex cases), no progress
 * - Explicit human request → escalate IMMEDIATELY, no investigation first
 * - Sentiment and self-reported confidence are UNRELIABLE proxies for case complexity
 * - Multiple customer matches → ask for more identifiers, never select by heuristic
 *
 * Exam pattern: agent escalates straightforward cases, handles complex ones alone
 * Fix: explicit escalation criteria with few-shot examples — not confidence scores or sentiment
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Escalation Triggers (Explicit Criteria)
// ============================================================
//
// ✅ Escalate when:
//   1. Customer EXPLICITLY requests a human agent
//      → Immediate escalation — no investigation attempts first
//   2. Policy gap: the customer's situation isn't covered by policy
//      Example: customer asks for competitor price match when policy only covers own-site adjustments
//   3. Policy exception required: customer qualifies but exception needs human approval
//   4. Cannot make meaningful progress after 2+ attempts
//   5. Refund/adjustment exceeds automated limit
//
// ❌ DO NOT escalate based on:
//   - Customer frustration or negative sentiment alone
//   - Agent's self-reported "low confidence" (poorly calibrated)
//   - Case "seeming complex" without a specific policy trigger

const escalationSystemPrompt = `You are a customer support agent. Apply these escalation criteria:

## ESCALATE IMMEDIATELY (without investigation):
- Customer explicitly says: "I want to speak to a human", "connect me to a person",
  "let me talk to your manager", or any similar request for human assistance
- Do not attempt to resolve first — escalate immediately when this is requested

## ESCALATE after attempting resolution:
- Policy gap: customer's situation isn't addressed by our documented policies
  Example: "Will you match a competitor's price?" — our policy only covers own-site adjustments
- Refund amount exceeds $500 automated limit
- Cannot verify customer identity after 2 attempts
- Attempted resolution 2+ times without success

## RESOLVE autonomously (do not escalate):
- Standard damage replacement with photo evidence (within 30-day window)
- Order status inquiries
- Refunds under $500 for delivered items within 30 days
- Address or payment method updates

## When customer is frustrated but case is resolvable:
- Acknowledge frustration, then offer resolution
- Example: "I understand this is frustrating. I can process your refund right now —
  would you like me to do that, or would you prefer to speak with a team member?"
- If customer reiterates desire for human → then escalate

## Few-shot examples:

User: "I need a refund for my damaged order ORD-123"
→ Resolve autonomously (standard damage case)

User: "I want to talk to a real person right now"
→ Escalate immediately: "I'll connect you with a team member right away. [escalate]"

User: "Your competitor is selling this for $50 less, will you match it?"
→ Escalate: policy only covers own-site price adjustments, not competitor matching`;

// ============================================================
// Multiple Customer Matches: Ask for More Identifiers
// ============================================================
//
// ❌ BAD: select the "most likely" match using heuristics
//   Two customers named "Alice Johnson" → pick the one with a recent order
//   → Wrong customer gets access to another customer's data (security incident)
//
// ✅ CORRECT: request additional identifier from the customer
//   "I found multiple accounts matching that name. Could you provide your:
//    - Email address, OR
//    - Phone number last 4 digits, OR
//    - Order number"

// ============================================================
// Ambiguity Resolution Pattern: Requesting Additional Identifiers
// ============================================================

async function resolveCustomerAmbiguity(
  customerName: string,
  matches: Array<{ customer_id: string; email_hint: string; phone_hint: string }>
): Promise<string> {
  if (matches.length === 1) {
    return matches[0].customer_id;
  }

  // ✅ Multiple matches → ask for discriminating identifier
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    system: escalationSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Customer says their name is "${customerName}". Found ${matches.length} matching accounts. Generate a message asking for an additional identifier.`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ============================================================
// Escalation with Structured Handoff
// ============================================================
//
// When escalating, the human agent needs full context — they have NO access to the transcript.
// Include everything needed to continue without starting over.

interface EscalationHandoff {
  customer_id: string | null;
  customer_name: string;
  reason: "explicit_request" | "policy_gap" | "limit_exceeded" | "no_progress";
  policy_gap_description?: string;
  issues_raised: string[];
  actions_taken: string[];
  recommended_action: string;
  urgency: "standard" | "urgent";
}

function buildEscalationHandoff(
  partial: Partial<EscalationHandoff> & Pick<EscalationHandoff, "reason" | "customer_name">
): EscalationHandoff {
  return {
    customer_id: null,
    issues_raised: [],
    actions_taken: [],
    recommended_action: "Review case and assist customer",
    urgency: "standard",
    ...partial,
  };
}

export async function runEscalationDemo(): Promise<void> {
  console.log("\n=== Task 5.2: Escalation Patterns ===\n");

  const testCases = [
    "I want to speak to a manager right now",
    "Can you match the price I found at your competitor?",
    "My order ORD-456 arrived damaged, I want a refund",
    "I'm very frustrated, this is unacceptable",
  ];

  for (const userMessage of testCases) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 256,
      system: escalationSystemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .slice(0, 120);

    console.log(`User: "${userMessage}"`);
    console.log(`Agent: ${text}...\n`);
  }

  // Multiple customer matches example
  console.log("--- Multiple Match Resolution ---");
  const message = await resolveCustomerAmbiguity("Alice Johnson", [
    { customer_id: "CUST-001", email_hint: "a***@gmail.com", phone_hint: "***-1234" },
    { customer_id: "CUST-002", email_hint: "a***@yahoo.com", phone_hint: "***-5678" },
  ]);
  console.log("Ambiguity response:", message);
}

await runEscalationDemo();
