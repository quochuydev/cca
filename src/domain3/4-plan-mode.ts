/**
 * Task 3.4: Determine When to Use Plan Mode vs Direct Execution
 *
 * Key concepts tested:
 * - Plan mode: safe exploration + design before committing to changes
 * - Direct execution: immediate action for well-scoped, single-file changes
 * - Explore subagent: isolates verbose discovery output from main context
 *
 * Exam pattern: "which approach should you take?"
 * Signal words for plan mode: "restructure", "migrate", "multiple files", "architectural"
 * Signal words for direct execution: "single file", "clear stack trace", "add a check"
 */

// ============================================================
// Plan Mode: When to Use
// ============================================================
//
// Use plan mode when the task has ANY of:
//   - Large-scale changes (many files affected)
//   - Multiple valid implementation approaches to evaluate
//   - Architectural decisions (service boundaries, dependency structure)
//   - Unknown scope (you haven't explored the codebase yet)
//   - High risk of costly rework if wrong approach is chosen
//
// Examples that require plan mode:
//   ✅ "Restructure monolith into microservices" (dozens of files, architectural decisions)
//   ✅ "Migrate from Express to Fastify across 45+ route files" (large-scale, risky)
//   ✅ "Choose between REST and GraphQL for our new API" (multiple valid approaches)
//   ✅ "Understand and document the auth module before refactoring" (unknown scope)
//
// What plan mode enables:
//   - Explore codebase without making changes
//   - Design implementation approach and get feedback before committing
//   - Identify dependencies and risks upfront
//   - Prevent costly rework discovered mid-implementation

// ============================================================
// Direct Execution: When to Use
// ============================================================
//
// Use direct execution when:
//   - Change is well-understood with clear scope
//   - Affects a single file or very few files
//   - Stack trace or error message pinpoints exactly what needs changing
//   - No architectural decisions required
//
// Examples that use direct execution:
//   ✅ "Fix the null pointer exception at line 42 in userService.ts" (clear stack trace)
//   ✅ "Add date validation before saving to the database in createOrder()" (single function)
//   ✅ "Rename the `getUserById` function to `findUserById` throughout the file" (contained)
//   ✅ "Add a missing return statement in the auth middleware" (obvious fix)
//
// ❌ Don't use direct execution for:
//   "Refactor our entire authentication system" → architectural scope → use plan mode first

// ============================================================
// Explore Subagent: Managing Context During Discovery
// ============================================================
//
// Problem: discovery phases produce verbose output (Grep results, file listings, import traces)
// that fills the main context window before implementation even starts.
//
// ❌ BAD: running discovery in the main session
//   → 50+ Grep results + 20 file reads accumulate in context
//   → Implementation phase starts with degraded context quality
//
// ✅ GOOD: delegate discovery to Explore subagent
//   → Explore runs with its own context (verbose output stays isolated)
//   → Returns a SUMMARY to the main agent (e.g., "found 12 callers of processRefund in 4 files")
//   → Main agent starts implementation with clean context
//
// Pattern:
//   1. Main agent: "Explore subagent: find all callers of processRefund and their dependencies"
//   2. Explore runs Grep, Read, traces imports → produces verbose intermediate output
//   3. Explore returns: { callers: [...], files: [...], summary: "..." }
//   4. Main agent: uses the summary to plan targeted edits

// ============================================================
// Combining Plan Mode + Direct Execution
// ============================================================
//
// Optimal pattern for complex tasks:
//   Phase 1: Plan mode + Explore subagent → understand codebase, design approach
//   Phase 2: Direct execution → implement the planned approach
//
// Example: "Migrate our HTTP client from axios to fetch"
//   Plan mode:
//     - Explore subagent finds all axios usages across codebase
//     - Identify patterns: interceptors, error handling, timeouts
//     - Design the migration approach and new wrapper API
//   Direct execution:
//     - Implement the planned fetch wrapper
//     - Update each axios call to use the new wrapper (file by file)

// ============================================================
// Decision Guide
// ============================================================
//
// | Signal in request                    | Mode              |
// |--------------------------------------|-------------------|
// | "restructure", "migrate", "redesign" | Plan mode         |
// | "45+ files", "multiple packages"     | Plan mode         |
// | "architectural decisions"            | Plan mode         |
// | "unfamiliar codebase"                | Plan mode         |
// | "single file", "clear stack trace"   | Direct execution  |
// | "add a check", "fix a typo"          | Direct execution  |
// | "rename a function"                  | Direct execution  |

export function planModeSummary(): void {
  console.log("=== Task 3.4: Plan Mode vs Direct Execution ===");
  console.log();
  console.log("Plan mode: complex tasks, large-scale, architectural, unknown scope");
  console.log("  Explore subagent → isolates verbose discovery, returns summary");
  console.log();
  console.log("Direct execution: single-file, clear scope, obvious fix");
  console.log();
  console.log("Optimal: plan mode (investigate) → direct execution (implement)");
}

planModeSummary();
