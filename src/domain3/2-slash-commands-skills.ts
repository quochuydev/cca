/**
 * Task 3.2: Create and Configure Custom Slash Commands and Skills
 *
 * Key concepts tested:
 * - .claude/commands/ (project-scoped, version-controlled) vs ~/.claude/commands/ (personal)
 * - Skills in .claude/skills/ with SKILL.md frontmatter: context: fork, allowed-tools, argument-hint
 * - context: fork runs the skill in an isolated sub-agent — output does NOT pollute main conversation
 * - Personal skill variants in ~/.claude/skills/ with different names (don't affect teammates)
 *
 * Exam distinction:
 * - Slash commands: simple prompt templates invoked on demand
 * - Skills: richer, support frontmatter options for isolation and tool restriction
 * - CLAUDE.md: always-loaded universal standards (not invoked, always present)
 */

// ============================================================
// Project-Scoped Slash Commands: .claude/commands/
// ============================================================
//
// Location: .claude/commands/<name>.md
// Availability: all teammates who clone/pull the repo
// Invocation: /<name> in Claude Code
//
// Example: .claude/commands/review.md
// ─────────────────────────────────────
// # Code Review
// Review the staged changes for:
// - Logic bugs and off-by-one errors
// - Security vulnerabilities (injection, XSS, auth bypass)
// - Missing error handling for external calls
// Skip: minor style issues, personal preference formatting
// ─────────────────────────────────────
//
// ✅ Committed to repo → all developers get /review automatically

// ============================================================
// Personal Slash Commands: ~/.claude/commands/
// ============================================================
//
// Location: ~/.claude/commands/<name>.md
// Availability: this developer only (not in version control)
// Use for: personal shortcuts, experimental prompts, sensitive workflows
//
// ❌ Never put team-required commands here — teammates won't have them

// ============================================================
// Skills: .claude/skills/ with SKILL.md Frontmatter
// ============================================================
//
// Skills are richer than commands — they support frontmatter options:
//
// .claude/skills/analyze-codebase/SKILL.md:
// ─────────────────────────────────────────
// ---
// context: fork          ← runs in isolated sub-agent (output stays out of main context)
// allowed-tools:
//   - Read
//   - Glob
//   - Grep              ← restricts which tools the skill can use
// argument-hint: "Which module to analyze? (e.g. src/auth)"
// ---
// # Codebase Analysis
// Analyze the module provided in $ARGUMENTS.
// Map all exported functions, their dependencies, and any circular imports.
// Return a structured summary — do not modify any files.
// ─────────────────────────────────────────

// ============================================================
// context: fork — Isolation from Main Conversation
// ============================================================
//
// WITHOUT context: fork:
//   Skill output is appended to the main conversation context.
//   → Verbose codebase analysis fills the main context window
//   → Subsequent turns slow down and lose focus
//
// WITH context: fork:
//   Skill runs in a separate sub-agent context.
//   → Only the final result is returned to the main conversation
//   → Main context stays clean and focused
//
// ✅ Use context: fork for:
//   - Codebase exploration (verbose Grep/Read output)
//   - Brainstorming alternatives (exploratory reasoning)
//   - Any skill that produces significant intermediate output

// ============================================================
// allowed-tools Frontmatter: Restricting Tool Access
// ============================================================
//
// Example: a "write-tests" skill that should ONLY write files, never run bash
// ---
// allowed-tools:
//   - Read
//   - Write
// ---
// → Skill cannot call Bash, Grep, or Glob — prevents accidental destructive actions
//
// ✅ Use to enforce least-privilege for each skill's purpose

// ============================================================
// argument-hint Frontmatter: Prompting for Parameters
// ============================================================
//
// When developer runs /analyze-codebase without arguments:
//   argument-hint: "Which module to analyze? (e.g. src/auth)"
//   → Claude Code prompts: "Which module to analyze?"
//   → Developer types the module name
//   → $ARGUMENTS is populated automatically
//
// Without argument-hint: Claude may proceed with an empty $ARGUMENTS and produce useless output

// ============================================================
// Skills vs CLAUDE.md: When to Use Each
// ============================================================
//
// | Mechanism  | When it loads        | Best for                          |
// |------------|----------------------|-----------------------------------|
// | CLAUDE.md  | Every session always | Universal coding standards, rules |
// | Skill      | Only when invoked    | Task-specific on-demand workflows |
//
// ❌ BAD: putting a codebase analysis workflow in CLAUDE.md
//   → It loads every session, consuming context even when not needed
//
// ✅ GOOD: putting it in a skill with context: fork
//   → Runs only when invoked, output isolated from main context

// ============================================================
// Personal Skill Variants: ~/.claude/skills/
// ============================================================
//
// If you want a modified version of a team skill (e.g., stricter review criteria):
//   ~/.claude/skills/my-review/SKILL.md  (different name → no conflict with team /review)
//
// ✅ Personal variants let you experiment without affecting teammates

export function slashCommandsSkillsSummary(): void {
  console.log("=== Task 3.2: Slash Commands & Skills ===");
  console.log();
  console.log("Commands:");
  console.log("  .claude/commands/<name>.md   — project-scoped, shared via git");
  console.log("  ~/.claude/commands/<name>.md — personal, not shared");
  console.log();
  console.log("Skill frontmatter options:");
  console.log("  context: fork      — isolate output from main conversation");
  console.log("  allowed-tools: []  — restrict tools during skill execution");
  console.log("  argument-hint: ''  — prompt user for required parameters");
  console.log();
  console.log("Skills vs CLAUDE.md:");
  console.log("  CLAUDE.md → always loaded (universal standards)");
  console.log("  Skills    → on-demand invocation (task-specific workflows)");
}

slashCommandsSkillsSummary();
