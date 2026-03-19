/**
 * Task 3.5: Apply Iterative Refinement Techniques for Progressive Improvement
 *
 * Key concepts tested:
 * - Concrete input/output examples: most effective when prose descriptions are inconsistent
 * - Test-driven iteration: write tests first, share failures to guide Claude
 * - Interview pattern: have Claude ask questions before implementing in unfamiliar domains
 * - Single message vs sequential: interacting fixes → one message; independent fixes → sequential
 */

// ============================================================
// Technique 1: Concrete Input/Output Examples
// ============================================================
//
// When to use: prose descriptions produce inconsistent results across runs
//
// ❌ BAD (prose description — interpreted differently each run):
//   "Format the date field to be more readable"
//   → Run 1: "March 19, 2026"
//   → Run 2: "2026-03-19"
//   → Run 3: "19/03/2026"
//
// ✅ GOOD (2-3 concrete examples eliminate ambiguity):
//   Input:  "2026-03-19T14:30:00Z"
//   Output: "Mar 19, 2026 at 2:30 PM UTC"
//
//   Input:  "2026-01-01T00:00:00Z"
//   Output: "Jan 1, 2026 at 12:00 AM UTC"
//
//   Input:  null
//   Output: "—" (em dash for missing dates)
//
// Now Claude understands: format string, timezone display, null handling — exactly.

// ============================================================
// Technique 2: Test-Driven Iteration
// ============================================================
//
// Process:
//   1. Write tests covering: expected behavior, edge cases, performance requirements
//   2. Run tests → share failures with Claude
//   3. Claude fixes the specific failing cases
//   4. Repeat until all tests pass
//
// ✅ Advantages:
//   - Failures are objective — no ambiguity about what "correct" means
//   - Claude targets specific failing assertions, not the whole function
//   - Progress is measurable (X/N tests passing)
//
// Example iteration:
//   Turn 1: "Here are my tests for formatDate(). They're all failing."
//   Claude: implements formatDate()
//   Turn 2: "3 tests pass but 2 fail: null input throws, leap year wrong"
//   Claude: fixes null handling and leap year logic
//   Turn 3: "All 5 tests pass ✓"

// ============================================================
// Technique 3: The Interview Pattern
// ============================================================
//
// When to use: implementing in an unfamiliar domain with non-obvious design decisions
//
// Instead of: "Implement a caching layer for our API"
// Use: "Before implementing a caching layer, ask me questions to surface design considerations
//       I may not have anticipated."
//
// Claude will ask:
//   - "What cache invalidation strategy should I use? (TTL, event-based, manual?)"
//   - "Should the cache be in-process (memory) or distributed (Redis)?"
//   - "What happens on cache miss — should I return stale data or wait for fresh?"
//   - "Are there cache stampede scenarios to handle?"
//
// ✅ Surfaces considerations the developer hadn't thought of BEFORE implementation
//    → Prevents expensive rework from undiscovered requirements

// ============================================================
// Technique 4: Single Message vs Sequential Iteration
// ============================================================
//
// INTERACTING issues → provide ALL in ONE message
//   Why: if fixes depend on each other, applying them sequentially causes merge conflicts
//        or requires re-reading earlier fixes
//   Example: "Fix these 3 issues: (1) the null check, (2) the return type, (3) the import —
//             they all interact because the return type change affects the null check and import"
//
// INDEPENDENT issues → fix SEQUENTIALLY, one at a time
//   Why: easier to verify each fix in isolation; easier to revert if one fix is wrong
//   Example: Fix A (typo in function name) → verify → Fix B (missing error handler) → verify

// ============================================================
// Technique 5: Specific Test Cases for Edge Case Fixes
// ============================================================
//
// When an edge case is mishandled, provide the EXACT input/output expected:
//
// "The migration script fails on null values. Here's the failing case:
//  Input record: { id: 1, name: null, email: 'a@b.com' }
//  Expected output: { id: 1, name: '', email: 'a@b.com' }  (null → empty string)
//  Current output: throws TypeError: Cannot read property 'toLowerCase' of null"
//
// Much more effective than: "Fix the null handling in the migration script"

export function iterativeRefinementSummary(): void {
  console.log("=== Task 3.5: Iterative Refinement Techniques ===");
  console.log();
  console.log("1. Input/Output Examples: 2-3 concrete examples beat prose descriptions");
  console.log("2. Test-driven: write tests first, share failures to guide correction");
  console.log("3. Interview pattern: Claude asks questions before implementing in new domains");
  console.log("4. Single message: interacting issues; Sequential: independent issues");
  console.log("5. Exact failing test case: input + expected + actual output for edge cases");
}

iterativeRefinementSummary();
