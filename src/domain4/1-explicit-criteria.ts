/**
 * Task 4.1: Design Prompts with Explicit Criteria to Improve Precision and Reduce False Positives
 *
 * Key concepts tested:
 * - Explicit categorical criteria >> vague confidence-based instructions
 * - "be conservative" and "only report high-confidence findings" do NOT reduce false positives
 * - High false positive categories erode developer trust in ALL findings (including accurate ones)
 *
 * Exam pattern: code review produces too many false positives
 * Wrong fix: "be more conservative" or "only report if 90% confident"
 * Right fix: define EXACTLY which categories to report vs skip, with concrete examples
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// ANTI-PATTERN: Vague confidence-based instructions
// ============================================================
// ❌ BAD system prompt — does not improve precision:
//
// "Review this code for issues. Be conservative and only report high-confidence findings.
//  If you're not sure, skip it."
//
// Problems:
//   - "high-confidence" is not calibrated — model's confidence ≠ actual issue probability
//   - Model still flags style preferences and local patterns (same false positive rate)
//   - Developers lose trust in ALL findings when categories like "naming" produce noise

// ============================================================
// CORRECT: Explicit categorical criteria
// ============================================================

const reviewSystemPrompt = `You are a code reviewer. Apply the following criteria precisely.

## REPORT these categories (bugs and security only):

**Bugs:**
- Logic errors where the code does something different from what comments/docs claim
- Off-by-one errors in loop bounds or array indexing
- Null/undefined dereference on values that can be null (check the type signature)
- Race conditions in async code where ordering matters

**Security:**
- SQL/NoSQL injection: user input passed to queries without parameterization
- XSS: user input rendered as innerHTML or via dangerouslySetInnerHTML
- Auth bypass: conditions where authentication checks can be skipped
- Hardcoded secrets: API keys, passwords, tokens in source code

## SKIP these categories (do NOT report):

- Code style preferences (naming conventions, whitespace, formatting)
- Patterns that match the existing codebase style (even if unusual)
- Performance micro-optimizations without evidence of a bottleneck
- Missing comments or documentation
- Refactoring suggestions ("this could be cleaner")
- Anything that requires knowing runtime data to evaluate

## Output format per finding:
{
  "file": "path/to/file.ts",
  "line": 42,
  "category": "bug|security",
  "severity": "critical|high|medium",
  "issue": "one-sentence description of what is wrong",
  "evidence": "exact code snippet that demonstrates the issue",
  "suggested_fix": "concrete corrected code"
}`;

// ============================================================
// Severity Criteria with Concrete Examples
// ============================================================
//
// ❌ BAD: vague severity levels
//   critical = "very serious", high = "serious", medium = "moderate"
//   → Inconsistent classification across runs
//
// ✅ GOOD: concrete examples per severity level
//
// critical: Exploitable in production with no preconditions
//   Example: `query("SELECT * FROM users WHERE id=" + req.params.id)`
//   → SQL injection, directly exploitable
//
// high: Exploitable with common attacker preconditions
//   Example: `res.send("<div>" + userInput + "</div>")`
//   → XSS, requires attacker-controlled input (common)
//
// medium: Bug that causes incorrect behavior in a specific, reproducible scenario
//   Example: `if (arr.length > 0) return arr[arr.length]` (off-by-one → undefined)
//   → Wrong but requires specific array state

// ============================================================
// Temporarily Disabling High False-Positive Categories
// ============================================================
//
// Situation: "naming conventions" and "style" categories generate 80% of findings
//            but are almost always dismissed by developers
//
// ✅ Strategy:
//   1. Remove those categories from the REPORT list entirely
//   2. Developer trust recovers (remaining findings are almost always valid)
//   3. Improve prompts for the removed categories separately
//   4. Re-enable when precision improves
//
// This is better than: "be more conservative about style findings"
//   → That instruction doesn't reliably reduce the false positive rate

export async function runExplicitCriteriaDemo(): Promise<void> {
  console.log("\n=== Task 4.1: Explicit Review Criteria ===\n");

  const codeToReview = `
function getUser(req, res) {
  // Fetch user by ID from database
  const userId = req.query.id;
  db.query("SELECT * FROM users WHERE id=" + userId, (err, result) => {
    if (result.length > 0) {
      res.send("<div>Welcome " + result[0].name + "</div>");
    }
  });
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: reviewSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Review this code:\n\`\`\`javascript\n${codeToReview}\n\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  console.log("Review findings:", text);
}

await runExplicitCriteriaDemo();
