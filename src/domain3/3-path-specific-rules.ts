/**
 * Task 3.3: Apply Path-Specific Rules for Conditional Convention Loading
 *
 * Key concepts tested:
 * - .claude/rules/ files with YAML frontmatter `paths` field containing glob patterns
 * - Path-scoped rules load ONLY when editing matching files — irrelevant rules stay out of context
 * - Glob patterns span multiple directories (advantage over directory-level CLAUDE.md)
 *
 * Exam pattern: test conventions must apply to *.test.tsx files spread across the entire codebase
 * Fix: .claude/rules/testing.md with paths: ["**/*.test.tsx"] — NOT per-subdirectory CLAUDE.md files
 */

// ============================================================
// Path-Specific Rule Files: Structure
// ============================================================
//
// File: .claude/rules/testing.md
// ─────────────────────────────────────────────────────────
// ---
// paths:
//   - "**/*.test.ts"
//   - "**/*.test.tsx"
//   - "**/*.spec.ts"
// ---
// # Testing Conventions
// - Use describe/it structure with descriptive names
// - Mock all HTTP calls with msw — never make real network calls in tests
// - Each test file must have a corresponding implementation file
// - Snapshot tests require explicit team approval before committing
// ─────────────────────────────────────────────────────────
//
// When editing Button.test.tsx → this rule loads automatically
// When editing Button.tsx     → this rule does NOT load (no wasted context)

// ============================================================
// Glob Pattern Examples
// ============================================================
//
// paths: ["**/*.test.tsx"]           — all test files anywhere in codebase
// paths: ["src/api/**/*"]            — everything under src/api/
// paths: ["terraform/**/*"]          — all Terraform files
// paths: ["**/*.graphql"]            — all GraphQL schema files
// paths: ["packages/auth/**/*"]      — auth package only
// paths: ["**/*.migration.ts"]       — database migration files

// ============================================================
// Path-Specific Rules vs Directory-Level CLAUDE.md
// ============================================================
//
// Scenario: test files live next to their implementations across the whole codebase
//   src/components/Button.tsx
//   src/components/Button.test.tsx
//   src/api/users.ts
//   src/api/users.test.ts
//   src/utils/format.ts
//   src/utils/format.test.ts
//
// ❌ BAD: directory-level CLAUDE.md in each directory
//   src/components/CLAUDE.md  ← must create and maintain in EVERY directory
//   src/api/CLAUDE.md         ← duplicated conventions, drift over time
//   src/utils/CLAUDE.md       ← doesn't scale to hundreds of directories
//
// ✅ GOOD: one .claude/rules/testing.md with paths: ["**/*.test.tsx", "**/*.test.ts"]
//   → Single source of truth for all test conventions
//   → Automatically applies to any test file, regardless of location
//   → Adding a new directory doesn't require creating a new CLAUDE.md

// ============================================================
// Multiple Rule Files: Different Conventions Per File Type
// ============================================================
//
// .claude/rules/
//   testing.md         paths: ["**/*.test.*"]         — test file conventions
//   api-handlers.md    paths: ["src/api/**/*"]         — async/await error handling
//   react-components.md paths: ["src/components/**/*"] — functional style with hooks
//   db-models.md       paths: ["src/models/**/*"]      — repository pattern
//   terraform.md       paths: ["terraform/**/*"]       — HCL conventions
//   migrations.md      paths: ["**/*.migration.ts"]    — migration safety rules
//
// No paths field → file loads for ALL sessions (equivalent to CLAUDE.md import)

// ============================================================
// Token Efficiency: Only Relevant Context Loaded
// ============================================================
//
// Without path-scoping: all conventions load every session
//   → React developer editing a component sees Terraform rules (irrelevant)
//   → Context fills with noise, increasing cost and reducing focus
//
// With path-scoping: only matching rules load
//   → Editing Button.tsx loads only react-components.md
//   → Editing main.tf loads only terraform.md
//   → Context contains exactly what's needed

export function pathSpecificRulesSummary(): void {
  console.log("=== Task 3.3: Path-Specific Rules ===");
  console.log();
  console.log("File: .claude/rules/<name>.md with YAML frontmatter:");
  console.log("  ---");
  console.log('  paths: ["**/*.test.tsx", "**/*.test.ts"]');
  console.log("  ---");
  console.log();
  console.log("vs directory-level CLAUDE.md:");
  console.log("  Glob rules: one file covers files across ALL directories");
  console.log("  Dir CLAUDE.md: must be created in every subdirectory");
  console.log();
  console.log("Token benefit: irrelevant rules never load → cleaner context");
}

pathSpecificRulesSummary();
