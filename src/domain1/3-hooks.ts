/**
 * Task 1.5: Agent SDK Hooks for Tool Call Interception & Data Normalization
 *
 * Key concepts tested:
 * - PostToolUse: intercept tool results BEFORE the model processes them
 * - PreToolUse: intercept outgoing tool calls to enforce compliance rules
 * - Hooks provide DETERMINISTIC guarantees vs prompt instructions (probabilistic)
 * - Use hooks when business rules MUST be enforced, not just guided
 *
 * Exam distinction:
 * - Prompt: "Always check refund amount before processing" → probabilistic, ~12% failure
 * - Hook:   PreToolUse on process_refund, blocks if amount > $500   → deterministic, 0% bypass
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  HookCallback,
  HookJSONOutput,
  PostToolUseHookInput,
  PreToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";

// ============================================================
// PostToolUse Hook: Normalize heterogeneous data formats
// Called AFTER the tool executes, BEFORE the model sees the result.
// Use updatedMCPToolOutput to replace what the model receives.
// ============================================================
const normalizeToolOutput: HookCallback = async (input): Promise<HookJSONOutput> => {
  const postInput = input as PostToolUseHookInput;
  const raw = postInput.tool_response;
  if (!raw) return {};

  let data: Record<string, unknown>;
  try {
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    data = JSON.parse(str);
  } catch {
    return {}; // Can't parse — pass through unchanged
  }

  // Normalize Unix timestamps → ISO 8601
  // MCP tools from different vendors return different timestamp formats
  for (const field of ["created_at", "updated_at", "processed_at"]) {
    const val = data[field];
    if (typeof val === "number" && val > 1_000_000_000) {
      data[field] = new Date(val * 1000).toISOString();
    }
  }

  // Normalize numeric status codes → human-readable strings
  // Prevents Claude from misinterpreting "status: 2" vs "status: completed"
  const statusMap: Record<number, string> = {
    0: "pending",
    1: "processing",
    2: "completed",
    3: "failed",
    4: "cancelled",
  };
  if (typeof data.status === "number" && data.status in statusMap) {
    data.status = statusMap[data.status as number];
  }

  console.log("[PostToolUse Hook] Normalized output:", data);

  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      // updatedMCPToolOutput replaces what the model sees — normalization applied
      updatedMCPToolOutput: data,
      additionalContext: "Timestamps normalized to ISO 8601; status codes mapped to strings.",
    },
  };
};

// ============================================================
// PreToolUse Hook: Block policy-violating tool calls
// Called BEFORE tool executes — set decision: 'block' to prevent execution.
// ============================================================
const enforceRefundPolicy: HookCallback = async (input): Promise<HookJSONOutput> => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  const amount = toolInput?.amount as number | undefined;

  // ✅ DETERMINISTIC: This check ALWAYS runs — cannot be bypassed by model reasoning
  if (typeof amount === "number" && amount > 500) {
    console.log(`[PreToolUse Hook] BLOCKED: Refund $${amount} exceeds $500 policy limit`);
    return {
      // decision: 'block' prevents the tool call from executing entirely
      decision: "block",
      reason:
        `Refund of $${amount} blocked by policy. Maximum automated refund is $500. ` +
        `Escalate to human agent.`,
    };
  }

  console.log(`[PreToolUse Hook] Refund $${amount} approved — within policy limits`);
  return {};
};

// ============================================================
// Contrast: Why Hooks > Prompt Instructions for Compliance
// ============================================================
// ❌ PROMPT-BASED (probabilistic — exam distractor B/C):
//   system: "Never process refunds above $500. Always check the amount first."
//   → Model may occasionally skip the check under certain prompt conditions
//   → Production data shows 12% failure rate (exam scenario)
//
// ✅ HOOK-BASED (deterministic — correct answer A):
//   PreToolUse hook on "process_refund" → ALWAYS intercepts, ALWAYS enforces
//   → The gate runs in your code, not in Claude's reasoning
//   → Zero bypass rate for the enforcement rule itself

// ============================================================
// Combined example: normalization + enforcement
// ============================================================
export async function runWithHooks(userMessage: string): Promise<void> {
  console.log("\n=== Task 1.5: Agent SDK Hooks ===");
  console.log(`User: ${userMessage}\n`);

  for await (const message of query({
    prompt: userMessage,
    options: {
      allowedTools: ["Bash"],
      hooks: {
        // PostToolUse: normalize outputs BEFORE model processes them
        PostToolUse: [
          {
            matcher: "get_customer|lookup_order",
            hooks: [normalizeToolOutput],
          },
        ],
        // PreToolUse: intercept and block policy-violating calls
        PreToolUse: [
          {
            matcher: "process_refund",
            hooks: [enforceRefundPolicy],
          },
        ],
      },
    },
  })) {
    if ("result" in message) {
      console.log("Result:", message.result);
    }
  }
}

// Run example — hook will block the $750 refund
await runWithHooks(
  "Customer alice@example.com wants a $750 refund for order ORD-44455"
);
