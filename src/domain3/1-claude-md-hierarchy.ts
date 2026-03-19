/**
 * Task 3.1: Configure CLAUDE.md Files with Appropriate Hierarchy, Scoping, and Modular Organization
 *
 * Key concepts tested:
 * - Three-level hierarchy: user (~/.claude/CLAUDE.md), project (root or .claude/CLAUDE.md),
 *   directory (subdirectory CLAUDE.md)
 * - User-level settings are NOT shared via version control — team instructions must be project-level
 * - @import syntax for modular CLAUDE.md composition
 * - .claude/rules/ as an alternative to a monolithic CLAUDE.md
 *
 * Exam pattern: new team member doesn't receive instructions
 * Root cause: instructions are in ~/.claude/CLAUDE.md (user-level), not committed to repo
 * Fix: move to project-level .claude/CLAUDE.md or root CLAUDE.md
 */

// ============================================================
// CLAUDE.md Configuration Hierarchy
// ============================================================
//
// LEVEL 1 — User-level: ~/.claude/CLAUDE.md
//   - Applies to THIS developer only
//   - NOT committed to version control
//   - Use for: personal preferences, personal aliases, private tool configs
//   ❌ NEVER put team instructions here — teammates won't receive them
//
// LEVEL 2 — Project-level: .claude/CLAUDE.md  OR  <root>/CLAUDE.md
//   - Committed to version control — shared with all teammates
//   - Loaded for every Claude Code session in this project
//   - Use for: universal coding standards, team conventions, review criteria
//   ✅ Put team-wide instructions HERE
//
// LEVEL 3 — Directory-level: <subdir>/CLAUDE.md
//   - Loaded when working in that subdirectory
//   - Use for: package-specific conventions in a monorepo
//   ✅ Useful when different packages have different stacks/conventions

// ============================================================
// Diagnosing Hierarchy Issues
// ============================================================
//
// Symptom: new team member's Claude session doesn't follow team conventions
// Diagnosis:
//   1. Run /memory in Claude Code to see which files are loaded
//   2. If team instructions appear only in ~/.claude/CLAUDE.md → they're user-level
//   3. That file isn't in the repo → new members don't have it
// Fix: copy instructions to root CLAUDE.md and commit

// ============================================================
// @import Syntax for Modular CLAUDE.md
// ============================================================
//
// Root CLAUDE.md:
//   @import .claude/rules/testing.md
//   @import .claude/rules/api-conventions.md
//   @import packages/auth/CLAUDE.md       ← package-specific standards
//
// Benefits:
//   - Each package maintainer owns their own standards file
//   - Root CLAUDE.md stays concise (just imports + universal rules)
//   - Changes to a package's standards don't touch other packages' files
//
// ❌ BAD: one giant CLAUDE.md with all conventions mixed together
//   → Hard to maintain, unclear ownership, all loaded even when irrelevant
//
// ✅ GOOD: root CLAUDE.md imports focused topic files
//   → Each file has clear scope, changes are localized

// ============================================================
// .claude/rules/ Directory: Topic-Specific Rule Files
// ============================================================
//
// Alternative to @import — organize rules as separate files with optional path-scoping:
//
// .claude/rules/
//   testing.md           ← always loaded (no path restriction)
//   api-conventions.md   ← always loaded
//   deployment.md        ← always loaded
//   terraform.md         ← path-scoped (see domain3/3-path-specific-rules.ts)
//
// Example .claude/rules/testing.md:
// ---
// paths: ["**/*.test.ts", "**/*.spec.ts"]
// ---
// # Testing Conventions
// - Use describe/it blocks
// - Mock all external HTTP calls with msw
// - Snapshot tests require explicit approval before committing

// ============================================================
// /memory Command for Diagnosing Loaded Files
// ============================================================
//
// Run /memory in a Claude Code session to see:
//   - Which CLAUDE.md files are currently loaded
//   - Which .claude/rules/ files match the current file path
//   - User-level vs project-level vs directory-level sources
//
// Use to diagnose: "Why is Claude ignoring my convention?"
//   → /memory shows whether the relevant rule file was loaded
//   → If missing: check path-scoping, hierarchy level, @import chain

export function claudeMdHierarchySummary(): void {
  console.log("=== Task 3.1: CLAUDE.md Hierarchy ===");
  console.log();
  console.log("Hierarchy (highest to lowest priority):");
  console.log("  1. ~/.claude/CLAUDE.md       — user-level, NOT shared");
  console.log("  2. .claude/CLAUDE.md          — project-level, committed, shared");
  console.log("  3. <subdir>/CLAUDE.md         — directory-level, scoped to package");
  console.log();
  console.log("Modular composition:");
  console.log("  @import .claude/rules/testing.md");
  console.log("  @import .claude/rules/api-conventions.md");
  console.log();
  console.log("Diagnosis: run /memory to see which files are loaded");
}

claudeMdHierarchySummary();
