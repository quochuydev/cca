/**
 * Task 2.2: Structured Error Responses for MCP Tools
 *
 * Key concepts tested:
 * - MCP isError flag: the standard pattern for communicating tool failures back to the agent
 * - Error categories: transient (retry OK), validation (bad input), business (policy),
 *   permission (access denied)
 * - Uniform "Operation failed" errors prevent the agent from making recovery decisions
 * - Retryable vs non-retryable: returning metadata prevents wasted retry loops
 *
 * Exam pattern: agent retries indefinitely on a non-retryable error
 * Fix: include isRetryable: false so agent escalates instead of retrying
 */

// ============================================================
// MCP Error Response Type
// ============================================================
// isError: true signals to the agent that the tool call failed — not a successful empty result
interface MCPErrorResponse {
  isError: true;
  errorCategory: "transient" | "validation" | "permission" | "business";
  isRetryable: boolean;
  message: string;           // Human-readable description of what failed
  customerMessage?: string;  // Safe message to surface to the end user (business errors)
  retryAfterMs?: number;     // For transient errors: how long to wait before retrying
  field?: string;            // For validation errors: which input field is invalid
}

interface MCPSuccessResponse<T> {
  isError: false;
  data: T;
}

type MCPToolResponse<T> = MCPErrorResponse | MCPSuccessResponse<T>;

// ============================================================
// ANTI-PATTERN: Uniform error responses prevent recovery
// ============================================================
// ❌ BAD: all failures return the same string — agent cannot determine what to do next
//
// function processPaymentBAD(input: unknown): string {
//   try { ... }
//   catch { return "Operation failed" }  // Agent has no signal: retry? escalate? give up?
// }

// ============================================================
// CORRECT: Structured error responses with category + retryability
// ============================================================

// Simulates an MCP tool: process_payment
function processPayment(input: {
  customer_id: string;
  amount: number;
  currency: string;
}): MCPToolResponse<{ transaction_id: string; status: string }> {

  // Validation error: bad input — retrying the same call will never succeed
  if (!input.customer_id || input.customer_id.trim() === "") {
    return {
      isError: true,
      errorCategory: "validation",
      isRetryable: false,
      message: "customer_id is required and cannot be empty.",
      field: "customer_id",
    };
  }

  // Validation error: unsupported currency
  const supported = ["USD", "EUR", "GBP"];
  if (!supported.includes(input.currency)) {
    return {
      isError: true,
      errorCategory: "validation",
      isRetryable: false,
      message: `Currency '${input.currency}' is not supported. Supported: ${supported.join(", ")}.`,
      field: "currency",
    };
  }

  // Business error: policy violation — retrying will not help; surface customer message
  if (input.amount > 10_000) {
    return {
      isError: true,
      errorCategory: "business",
      isRetryable: false,
      message: `Payment of $${input.amount} exceeds the $10,000 automated limit. Escalate to human agent.`,
      // ✅ customerMessage: safe string the agent can forward directly to the user
      customerMessage:
        "This transaction requires manual review. A payment specialist will contact you within 1 business day.",
    };
  }

  // Permission error: account frozen — not a transient issue, requires human action
  if (input.customer_id === "FROZEN-999") {
    return {
      isError: true,
      errorCategory: "permission",
      isRetryable: false,
      message: "Account FROZEN-999 is frozen. Payments are suspended pending compliance review.",
      customerMessage: "Your account requires verification. Please contact support.",
    };
  }

  // Transient error: downstream service unavailable — safe to retry after a delay
  if (Math.random() < 0.1) {  // 10% simulated transient failure
    return {
      isError: true,
      errorCategory: "transient",
      isRetryable: true,
      message: "Payment gateway timeout. The service is temporarily unavailable.",
      retryAfterMs: 2000,  // Agent should wait 2s before retrying
    };
  }

  // Success path
  return {
    isError: false,
    data: {
      transaction_id: "TXN-" + Date.now(),
      status: "completed",
    },
  };
}

// ============================================================
// Valid Empty Result vs Access Failure (Exam Distinction)
// ============================================================
// ❌ BAD: returning isError: true when a search returns 0 results
//   → agent interprets "no results" as a tool failure and retries
//
// ✅ GOOD: isError: false + empty array = successful query with no matches
//         isError: true = the tool itself failed (access denied, service down)

interface SearchResult {
  id: string;
  name: string;
}

function searchCustomers(query: string): MCPToolResponse<SearchResult[]> {
  // Access failure: API key missing — this is an error, not an empty result
  if (!process.env.CRM_API_KEY) {
    return {
      isError: true,
      errorCategory: "permission",
      isRetryable: false,
      message: "CRM_API_KEY environment variable is not set. Configure credentials before retrying.",
    };
  }

  // ✅ Valid empty result: search succeeded, just no matches — NOT an error
  if (query === "zzz-no-match") {
    return {
      isError: false,
      data: [],  // Empty array = successful query, 0 results
    };
  }

  return {
    isError: false,
    data: [{ id: "CUST-1", name: "Alice Johnson" }],
  };
}

// ============================================================
// Agent-side error recovery logic (subagent pattern)
// ============================================================
// ✅ CORRECT: Subagent handles transient errors locally; only propagates non-recoverable ones

async function callWithLocalRetry(
  fn: () => MCPToolResponse<unknown>,
  maxRetries = 3
): Promise<MCPToolResponse<unknown>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = fn();

    if (!result.isError) return result;

    if (result.errorCategory === "transient" && result.isRetryable && attempt < maxRetries) {
      // ✅ Local recovery: retry transient errors here, don't burden the coordinator
      const delay = result.retryAfterMs ?? 1000;
      console.log(`  [Retry ${attempt}/${maxRetries}] Transient error — waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Non-recoverable or retries exhausted: propagate to coordinator with context
    return result;
  }
  // Should not reach here
  return fn();
}

// ============================================================
// Demo
// ============================================================
export async function runErrorResponseDemo(): Promise<void> {
  console.log("\n=== Task 2.2: Structured MCP Error Responses ===\n");

  const testCases: Array<Parameters<typeof processPayment>[0]> = [
    { customer_id: "CUST-123", amount: 99.99, currency: "USD" },   // success
    { customer_id: "",         amount: 50,    currency: "USD" },   // validation error
    { customer_id: "CUST-123", amount: 50,    currency: "BTC" },   // unsupported currency
    { customer_id: "CUST-123", amount: 15_000, currency: "USD" },  // business rule violation
    { customer_id: "FROZEN-999", amount: 100, currency: "USD" },   // permission error
  ];

  for (const input of testCases) {
    const result = processPayment(input);
    if (result.isError) {
      console.log(`[${result.errorCategory.toUpperCase()}] retryable=${result.isRetryable}`);
      console.log(`  Message: ${result.message}`);
      if (result.customerMessage) {
        console.log(`  Customer sees: "${result.customerMessage}"`);
      }
    } else {
      console.log(`[SUCCESS] txn=${result.data.transaction_id}`);
    }
    console.log();
  }

  // Empty result vs access failure
  console.log("--- Empty Result vs Access Failure ---");
  const accessFail = searchCustomers("alice");           // no API key in test env
  const emptyResult = searchCustomers("zzz-no-match");   // success, 0 results

  console.log("Access failure isError:", accessFail.isError);
  console.log("Empty result isError:", emptyResult.isError);
  if (!emptyResult.isError) {
    console.log("Empty result data:", emptyResult.data);  // []
  }
}

await runErrorResponseDemo();
