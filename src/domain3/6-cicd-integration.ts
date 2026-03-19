/**
 * Task 3.6: Integrate Claude Code into CI/CD Pipelines
 *
 * Key concepts tested:
 * - -p / --print flag: runs Claude Code in non-interactive mode (prevents input hangs in CI)
 * - --output-format json + --json-schema: machine-parseable structured output for PR comments
 * - CLAUDE.md provides project context (test standards, fixtures, review criteria) to CI runs
 * - Session context isolation: independent review instance catches more bugs than self-review
 *
 * Exam pattern: pipeline hangs waiting for input
 * Fix: add -p flag — it processes the prompt and exits without waiting for user input
 */

// ============================================================
// Non-Interactive Mode: -p / --print Flag
// ============================================================
//
// ❌ BAD (hangs in CI — waits for interactive input):
//   claude "Analyze this pull request for security issues"
//
// ✅ CORRECT (non-interactive — processes and exits):
//   claude -p "Analyze this pull request for security issues"
//
// The -p flag:
//   - Sends the prompt to Claude
//   - Outputs the result to stdout
//   - Exits cleanly — no waiting for user input
//   - Required for any CI/CD pipeline, GitHub Actions, cron jobs

// ============================================================
// Structured Output: --output-format json + --json-schema
// ============================================================
//
// For automated posting of inline PR comments, you need machine-parseable output:
//
// Step 1: Define a JSON schema for the review findings:
// {
//   "type": "object",
//   "properties": {
//     "findings": {
//       "type": "array",
//       "items": {
//         "type": "object",
//         "properties": {
//           "file": { "type": "string" },
//           "line": { "type": "number" },
//           "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
//           "category": { "type": "string", "enum": ["bug", "security", "performance"] },
//           "message": { "type": "string" },
//           "suggested_fix": { "type": "string" }
//         },
//         "required": ["file", "line", "severity", "category", "message"]
//       }
//     }
//   }
// }
//
// Step 2: Run Claude Code with structured output:
//   claude -p "Review the staged changes" \
//     --output-format json \
//     --json-schema ./review-schema.json
//
// Step 3: Parse findings and post as inline PR comments via GitHub API

// ============================================================
// CLAUDE.md: Providing Context to CI-Invoked Claude
// ============================================================
//
// CI runs load the project CLAUDE.md automatically.
// Use it to give Claude the context it needs for high-quality CI output:
//
// Root CLAUDE.md (CI-relevant sections):
// ─────────────────────────────────────────────────────────
// ## Code Review Criteria
// Report ONLY:
// - Logic bugs where the code does something different from what comments claim
// - Security: SQL injection, XSS, auth bypass, hardcoded secrets
// - Missing null checks on user-provided input
//
// Skip:
// - Style preferences, whitespace, naming conventions
// - Patterns that match existing codebase conventions (even if unusual)
//
// ## Testing Conventions
// - Tests use Vitest (not Jest) — do not suggest Jest-specific APIs
// - Available fixtures: createTestUser(), createTestOrder(), mockDatabase()
// - All async tests must use await — no .then() chains in test files
// ─────────────────────────────────────────────────────────

// ============================================================
// Avoiding Duplicate Comments: Prior Review Context
// ============================================================
//
// Problem: re-running review after new commits re-posts the same findings
//
// ✅ Solution: include prior review findings in context
//   claude -p "$(cat <<'EOF'
//   Review the new changes in this PR.
//   Prior review findings (already posted as comments):
//   $(cat prior-findings.json)
//
//   Report ONLY:
//   - New issues not present in the prior findings
//   - Issues from the prior findings that are still NOT addressed
//   Do NOT re-report issues that have already been fixed.
//   EOF
//   )" --output-format json --json-schema ./review-schema.json

// ============================================================
// Avoiding Duplicate Test Suggestions
// ============================================================
//
// Problem: test generation suggests scenarios already covered in the test suite
//
// ✅ Solution: provide existing test files in context
//   claude -p "$(cat <<'EOF'
//   Generate tests for the new processRefund() function.
//   Existing test file (do not duplicate these scenarios):
//   $(cat src/refund.test.ts)
//
//   Write only NEW test cases not covered above.
//   EOF
//   )"

// ============================================================
// Session Context Isolation: Independent Review Instance
// ============================================================
//
// ❌ BAD: using the same Claude session that generated code to review it
//   → Session retains reasoning context from generation
//   → Less likely to question its own decisions
//   → Subtle bugs in generated code get missed (~12% higher miss rate)
//
// ✅ GOOD: independent review instance (fresh session, no prior reasoning)
//   → No anchoring bias from generation phase
//   → More likely to catch logic errors, missing edge cases
//   → In CI: each review job is always a fresh session (naturally isolated)
//
// Exam key: "independent review instance" is more effective than
//   self-review instructions or extended thinking in the same session

export function cicdIntegrationSummary(): void {
  console.log("=== Task 3.6: CI/CD Integration ===");
  console.log();
  console.log("Non-interactive mode:");
  console.log('  claude -p "prompt here"   ← -p prevents interactive input hangs');
  console.log();
  console.log("Structured output for inline PR comments:");
  console.log("  claude -p '...' --output-format json --json-schema ./schema.json");
  console.log();
  console.log("CLAUDE.md: provides review criteria + test fixtures to CI runs");
  console.log("Prior findings in context: prevents duplicate comments on re-runs");
  console.log("Independent session: catches more bugs than self-review (no anchoring bias)");
}

cicdIntegrationSummary();
