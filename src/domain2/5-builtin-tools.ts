/**
 * Task 2.5: Select and Apply Built-in Tools Effectively
 *
 * Key concepts tested:
 * - Grep: content search — searching file contents for patterns (function names, imports, errors)
 * - Glob: file path pattern matching — finding files by name or extension patterns
 * - Read/Write: full file operations; Edit: targeted modifications via unique text matching
 * - When Edit fails (non-unique match), use Read + Write as a reliable fallback
 *
 * Exam pattern: agent reads ALL files upfront → slow, context-heavy
 * Fix: start with Grep to find entrypoints, then Read to follow imports incrementally
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// ============================================================
// Tool Selection Decision Guide
// ============================================================
//
// | Goal                                          | Tool       |
// |-----------------------------------------------|------------|
// | Find files by name / extension pattern        | Glob       |
// | Search file CONTENTS for a pattern            | Grep       |
// | Read a full file                              | Read       |
// | Make a targeted change to a specific location | Edit       |
// | Edit fails (non-unique text) or full rewrite  | Read+Write |
// | Run a system command                          | Bash       |

// ============================================================
// ANTI-PATTERN: Reading all files upfront
// ============================================================
// ❌ BAD: "Read all .ts files to understand the codebase"
//   → Fills context with irrelevant files; slow; token-expensive
//
// ✅ GOOD: Incremental approach
//   1. Grep for entrypoints (e.g., "export function", "export default")
//   2. Read only the files that match
//   3. Follow imports — Read only the modules actually referenced
//   4. Stop when you have enough context for the task

// ============================================================
// ANTI-PATTERN: Using Glob when you need Grep (and vice versa)
// ============================================================
// ❌ BAD: Using Glob to find "all files that contain a function"
//   Glob("**/*.ts")  → returns all TS files; you still have to search contents
//
// ✅ GOOD: Grep("processRefund", "**/*.ts") → returns only files that CONTAIN "processRefund"
//
// ❌ BAD: Using Grep with a filename pattern to find test files
//   Grep("test", "**/*") → matches files CONTAINING "test", not files NAMED "*.test.ts"
//
// ✅ GOOD: Glob("**/*.test.ts") → returns files NAMED with the .test.ts extension

// ============================================================
// Edit vs Read+Write: when to use each
// ============================================================
// Edit uses unique text matching to locate the change site.
// If the same text appears in multiple places in the file, Edit fails with an ambiguity error.
//
// ✅ Use Edit when:
//   - The text you're replacing appears exactly ONCE in the file
//   - You're making a small, targeted change
//
// ✅ Use Read + Write when:
//   - Edit fails with "multiple matches" or "text not found"
//   - You're rewriting large sections or the whole file
//   - The anchor text is too generic to be unique (e.g., "return result;")
//
// Pattern:
//   1. Try Edit first
//   2. If Edit fails → Read the full file → modify in memory → Write back

// ============================================================
// Tracing Function Usage Across Wrapper Modules
// ============================================================
// Problem: a function is re-exported through multiple wrapper modules;
// naive search misses some call sites.
//
// ✅ Correct approach:
//   1. Grep for all export statements in the module: Grep("^export", "src/utils/index.ts")
//   2. Collect all exported names from the result
//   3. For each exported name, Grep across the codebase to find callers
//   4. Follow re-exports: if moduleA re-exports from moduleB, search for both names
//
// Example: processRefund exported from refund.ts, re-exported from utils/index.ts
//   Step 1: Grep("processRefund", "src/**/*.ts") → finds direct callers
//   Step 2: Grep("from.*utils/index", "src/**/*.ts") → finds modules using the re-export
//   Step 3: Union of both results = complete call graph

// ============================================================
// Demo: Codebase Exploration via Built-in Tools
// ============================================================
export async function runBuiltinToolsDemo(): Promise<void> {
  console.log("\n=== Task 2.5: Built-in Tool Selection ===\n");

  // Demonstrate the incremental exploration strategy
  for await (const message of query({
    prompt: `
Explore this codebase to find all files that define exported async functions.
Use the efficient incremental approach:
1. Use Glob to find TypeScript source files (not node_modules, not .d.ts)
2. Use Grep to search those files for "export async function"
3. Report the file paths and function names — do NOT read every file upfront.
`,
    options: {
      allowedTools: ["Glob", "Grep", "Read"],
    },
  })) {
    if ("result" in message) {
      console.log("Result:\n", message.result);
    } else if (message.type === "assistant") {
      const toolCalls = message.message.content.filter((b) => b.type === "tool_use");
      if (toolCalls.length > 0) {
        console.log(`[Step] Tools used: ${toolCalls.map((b) => b.type === "tool_use" ? b.name : "").join(", ")}`);
      }
    }
  }
}

// ============================================================
// Edit vs Read+Write illustrated (static example — no file I/O needed)
// ============================================================
export function illustrateEditFallback(): void {
  console.log("\n--- Edit vs Read+Write Decision ---");

  // Scenario: file has `return result;` appearing 3 times
  // Edit("return result;", "return result ?? defaultValue;") → FAILS: ambiguous match
  console.log("Edit attempt: FAILS — 'return result;' appears multiple times");

  // Fallback: Read full file, apply change in memory, Write back
  console.log("Fallback: Read → modify in memory → Write (reliable)");

  // Scenario 2: unique anchor text
  // Edit("const MAX_RETRIES = 3;", "const MAX_RETRIES = 5;") → SUCCESS: unique in file
  console.log("Edit with unique anchor: SUCCESS");
}

await runBuiltinToolsDemo();
illustrateEditFallback();
