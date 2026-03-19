/**
 * Task 4.4: Implement Validation, Retry, and Feedback Loops for Extraction Quality
 *
 * Key concepts tested:
 * - Retry-with-error-feedback: append specific validation errors to the prompt on retry
 * - Limits of retry: retries fail when required info is simply ABSENT from the source
 * - detected_pattern field: tracks what code construct triggered each finding
 * - Semantic validation errors (values don't sum) ≠ schema syntax errors (eliminated by tool use)
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Extraction Tool with Self-Correction Fields
// ============================================================

const extractOrderTool: Anthropic.Tool = {
  name: "extract_order",
  description: "Extract structured order data for validation.",
  input_schema: {
    type: "object",
    properties: {
      order_id: { type: "string" },
      customer_name: { type: "string" },
      line_items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price: { type: "number" },
            line_total: { type: "number" },
          },
          required: ["description", "quantity", "unit_price", "line_total"],
        },
      },
      subtotal: { type: "number" },
      tax_amount: { type: "number" },
      stated_total: { type: "number" },
      // ✅ SELF-CORRECTION: extract calculated_total separately so we can detect discrepancies
      calculated_total: { type: "number", description: "Sum of all line_total values + tax_amount" },
      // ✅ conflict_detected: schema-enforced semantic validation flag
      conflict_detected: {
        type: "boolean",
        description: "True if |calculated_total - stated_total| > 0.01",
      },
    },
    required: [
      "order_id",
      "customer_name",
      "line_items",
      "subtotal",
      "tax_amount",
      "stated_total",
      "calculated_total",
      "conflict_detected",
    ],
  },
};

// ============================================================
// Semantic Validation: What Schema Cannot Catch
// ============================================================
//
// Schema syntax errors (eliminated by tool use):
//   - Missing required fields
//   - Wrong types (string instead of number)
//   - Invalid enum values
//
// Semantic validation errors (must be caught in code):
//   - line_items don't sum to subtotal
//   - subtotal + tax ≠ stated_total
//   - calculated_total ≠ stated_total (conflict_detected should be true)
//   - date is syntactically valid but logically impossible (e.g., Feb 30)

interface OrderExtraction {
  order_id: string;
  customer_name: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  subtotal: number;
  tax_amount: number;
  stated_total: number;
  calculated_total: number;
  conflict_detected: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  retryable: boolean;
}

function validateOrderExtraction(data: OrderExtraction): ValidationResult {
  const errors: string[] = [];

  // Semantic check 1: line item totals match
  for (const item of data.line_items) {
    const expected = item.quantity * item.unit_price;
    if (Math.abs(item.line_total - expected) > 0.01) {
      errors.push(
        `Line item "${item.description}": line_total=${item.line_total} but ` +
        `quantity(${item.quantity}) × unit_price(${item.unit_price}) = ${expected.toFixed(2)}`
      );
    }
  }

  // Semantic check 2: subtotal matches sum of line items
  const lineSum = data.line_items.reduce((sum, i) => sum + i.line_total, 0);
  if (Math.abs(data.subtotal - lineSum) > 0.01) {
    errors.push(`subtotal=${data.subtotal} but sum of line_totals=${lineSum.toFixed(2)}`);
  }

  // Semantic check 3: stated vs calculated total
  const calcTotal = data.subtotal + data.tax_amount;
  if (Math.abs(data.calculated_total - calcTotal) > 0.01) {
    errors.push(
      `calculated_total=${data.calculated_total} but subtotal+tax=${calcTotal.toFixed(2)}`
    );
  }
  if (Math.abs(data.stated_total - data.calculated_total) > 0.01) {
    errors.push(
      `stated_total=${data.stated_total} differs from calculated_total=${data.calculated_total}. ` +
      `conflict_detected should be true.`
    );
  }

  // ✅ Retryable: math errors are format/structural issues Claude can fix
  // ❌ NOT retryable: if required field is absent from source document
  return {
    valid: errors.length === 0,
    errors,
    retryable: errors.length > 0,  // Math errors are always retryable
  };
}

// ============================================================
// Retry-with-Error-Feedback Pattern
// ============================================================

async function extractWithRetry(
  documentText: string,
  maxRetries = 2
): Promise<OrderExtraction | null> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Extract order data:\n${documentText}` },
  ];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      tools: [extractOrderTool],
      tool_choice: { type: "tool", name: "extract_order" },
      system:
        "Extract order data precisely. Verify all arithmetic: " +
        "line_total = quantity × unit_price; calculated_total = subtotal + tax_amount. " +
        "Set conflict_detected = true if stated_total ≠ calculated_total.",
      messages,
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) break;

    const extracted = toolUse.input as OrderExtraction;
    const validation = validateOrderExtraction(extracted);

    if (validation.valid) {
      console.log(`✓ Extraction valid on attempt ${attempt}`);
      return extracted;
    }

    console.log(`✗ Attempt ${attempt} failed validation:`);
    validation.errors.forEach((e) => console.log(`  - ${e}`));

    if (attempt > maxRetries || !validation.retryable) {
      console.log("Retries exhausted or non-retryable error.");
      return null;
    }

    // ✅ RETRY-WITH-FEEDBACK: include original doc + failed extraction + specific errors
    // This is far more effective than just re-running the same prompt
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content:
        `The extraction has validation errors. Please correct it:\n\n` +
        `Original document:\n${documentText}\n\n` +
        `Previous extraction:\n${JSON.stringify(extracted, null, 2)}\n\n` +
        `Validation errors to fix:\n${validation.errors.map((e) => `- ${e}`).join("\n")}`,
    });
  }

  return null;
}

// ============================================================
// When Retries Are Ineffective: Absent Information
// ============================================================
//
// ❌ INEFFECTIVE retry: information simply doesn't exist in the source document
//   Document: "Delivery note. No pricing information."
//   Retry for: total_amount
//   → Will always fail — the data isn't there; retrying wastes API calls
//
// ✅ EFFECTIVE retry: format mismatch or structural output error
//   Document: "Total: $1,250.50" → extracted as string "1250.50" instead of number 1250.50
//   → Retry with error: "total_amount must be a number, got string '1250.50'"
//   → Claude fixes the type on retry

// ============================================================
// detected_pattern Field: Tracking False Positive Sources
// ============================================================
//
// When code review findings are dismissed by developers, track WHY:
//
// Finding schema with detected_pattern:
// {
//   "file": "auth.ts",
//   "line": 42,
//   "severity": "medium",
//   "issue": "Potential null dereference",
//   "detected_pattern": "optional_chain_missing",   ← what triggered this finding
//   "developer_action": "dismissed"                 ← logged when developer dismisses
// }
//
// Aggregate analysis: if 90% of "optional_chain_missing" findings are dismissed
// → The pattern is a false positive source → update prompt to exclude it

export async function runValidationRetryDemo(): Promise<void> {
  console.log("\n=== Task 4.4: Validation, Retry, and Feedback Loops ===\n");

  const orderDoc = `
ORDER #ORD-2026-042
Customer: Bob Smith

Items:
  - Widget A x3 @ $10.00 = $30.00
  - Widget B x2 @ $15.00 = $30.00   ← intentional error: should be $30.00 ✓ actually correct
  - Gadget Pro x1 @ $50.00 = $50.00

Subtotal: $110.00
Tax (10%): $11.00
Total: $121.00
`;

  const result = await extractWithRetry(orderDoc);
  if (result) {
    console.log("\nFinal extraction:", JSON.stringify(result, null, 2));
  }
}

await runValidationRetryDemo();
