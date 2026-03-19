/**
 * Task 4.2: Apply Few-Shot Prompting to Improve Output Consistency and Quality
 *
 * Key concepts tested:
 * - Few-shot examples are the MOST effective technique when detailed instructions alone are inconsistent
 * - Examples demonstrate ambiguous-case handling — model generalizes to novel patterns
 * - Few-shot reduces hallucination in extraction tasks (informal measurements, varied doc structures)
 * - 2-4 targeted examples suffice; more is not always better
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// ANTI-PATTERN: Detailed instructions alone — inconsistent results
// ============================================================
// System: "Extract the invoice total. If multiple amounts exist, use the final total.
//          Return as a number in USD. If missing, return null."
// → Run 1: 1250.00
// → Run 2: "$1,250.00"   ← string format, not number
// → Run 3: 1250           ← missing decimal
// Inconsistent despite clear instructions.

// ============================================================
// CORRECT: Few-shot examples demonstrate the expected output format
// ============================================================

const extractionSystemWithFewShot = `Extract the invoice total from the document.

## Examples

Document: "Invoice #1001\nItems: Widget x2 @ $50 = $100\nShipping: $15\nTotal Due: $115.00"
Output: {"total": 115.00, "currency": "USD", "found": true}

Document: "PO #2050\nAmount: one hundred fifty dollars"
Output: {"total": 150.00, "currency": "USD", "found": true}

Document: "Receipt\nSubtotal: €200\nVAT (20%): €40\nTotal: €240"
Output: {"total": 240.00, "currency": "EUR", "found": true}

Document: "Delivery note for order #3300. No payment information included."
Output: {"total": null, "currency": null, "found": false}

## Rules shown in examples:
- Informal measurements ("one hundred fifty dollars") convert to numbers
- Use the FINAL total, not subtotals or line items
- Non-USD currencies are preserved as-is (not converted)
- Missing invoice total → found: false, total: null (never fabricate)`;

// ============================================================
// Few-Shot for Ambiguous Code Review Cases
// ============================================================
//
// Without examples: model is uncertain whether to flag a pattern
// With examples: model generalizes the judgment to novel patterns
//
const reviewSystemWithFewShot = `Review code for bugs. Use these examples to calibrate judgment:

## Example 1: Flag this (genuine bug)
Code: if (users.length > 0) return users[users.length]
Issue: Off-by-one: users[users.length] is always undefined. Fix: users[users.length - 1]
Severity: medium

## Example 2: Skip this (acceptable pattern)
Code: const result = data?.value ?? defaultValue
Explanation: Optional chaining with nullish coalescing is a valid modern pattern, not a bug.
Action: skip — do NOT report

## Example 3: Flag this (security)
Code: res.send('<div>' + req.body.comment + '</div>')
Issue: XSS — user input rendered as raw HTML. Fix: use textContent or sanitize.
Severity: high

## Example 4: Skip this (false positive risk)
Code: for (let i = 0; i <= arr.length - 1; i++)
Explanation: Equivalent to i < arr.length. Unusual but not a bug.
Action: skip — do NOT report style preferences

Apply the same judgment to the code provided.`;

// ============================================================
// Few-Shot for Varied Document Structures
// ============================================================
//
// Problem: documents have citations in different formats (inline, bibliography, footnotes)
// Solution: examples for each format so model handles structural variety correctly

const citationSystemWithFewShot = `Extract all cited sources from the document.

## Example 1: Inline citations
Text: "AI adoption grew 42% (Smith et al., 2024) across healthcare sectors."
Output: [{"author": "Smith et al.", "year": 2024, "location": "inline"}]

## Example 2: Numbered footnotes
Text: "...accelerated development¹\n\n1. Johnson, R. (2023). AI Progress Report."
Output: [{"author": "Johnson, R.", "year": 2023, "title": "AI Progress Report", "location": "footnote:1"}]

## Example 3: Bibliography section
Text: "References:\nBrown, T. (2022). Large Language Models.\nLee, S. (2024). Deployment Patterns."
Output: [
  {"author": "Brown, T.", "year": 2022, "title": "Large Language Models", "location": "bibliography"},
  {"author": "Lee, S.", "year": 2024, "title": "Deployment Patterns", "location": "bibliography"}
]

## Example 4: No citations
Text: "This is an opinion piece with no cited sources."
Output: []`;

// ============================================================
// When Few-Shot Examples Enable Generalization
// ============================================================
//
// Exam key: few-shot examples allow the model to generalize to NOVEL patterns
// — not just patterns explicitly shown in examples
//
// Example: show 3 cases of "flag XSS" and "skip style preference"
// → Model correctly classifies a new pattern it hasn't seen
//   (e.g., template literal XSS without specific example)
//
// This is why few-shot outperforms long instruction lists:
// Instructions enumerate rules; examples teach JUDGMENT

export async function runFewShotDemo(): Promise<void> {
  console.log("\n=== Task 4.2: Few-Shot Prompting ===\n");

  const invoice = `
INVOICE #5501
Bill To: Acme Corp
---
Professional Services: two thousand dollars
Travel expenses: $350.00
---
Subtotal: $2,350
Tax (8%): $188
TOTAL AMOUNT DUE: $2,538.00`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    system: extractionSystemWithFewShot,
    messages: [{ role: "user", content: `Extract total:\n${invoice}` }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  console.log("Extracted:", text);
  // Expected: {"total": 2538.00, "currency": "USD", "found": true}
  // Note: "two thousand dollars" (informal) → 2000; uses FINAL total not subtotal
}

await runFewShotDemo();
