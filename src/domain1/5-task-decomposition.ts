/**
 * Task 1.6: Task Decomposition Strategies for Complex Workflows
 *
 * Key concepts tested:
 * - Prompt chaining: fixed sequential pipeline for predictable multi-aspect reviews
 * - Dynamic adaptive decomposition: generates subtasks based on what is discovered
 * - Per-file local analysis passes + separate cross-file integration pass
 * - Adaptive investigation plans that evolve as dependencies are discovered
 *
 * Exam distinction:
 * - Prompt chaining → use when steps are known upfront (code review, structured analysis)
 * - Dynamic decomposition → use when scope is unknown (legacy codebase, open-ended tasks)
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Pattern A: Prompt Chaining (Fixed Sequential Pipeline)
// Task 1.6 — predictable multi-aspect reviews
//
// Use when: steps are predetermined, each step produces input for the next.
// Example: Code review → analyze files individually, then cross-file integration pass.
// ============================================================

interface FileContent {
  name: string;
  content: string;
}

// Step 1: Analyze each file independently (local issues, no attention dilution)
async function analyzeFileLocally(file: FileContent): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Analyze this file for local issues only (bugs, logic errors, security problems within this file).
Do NOT comment on cross-file dependencies — that comes in a later pass.

File: ${file.name}
\`\`\`
${file.content}
\`\`\`

Return structured findings: { file, issues: [{line, severity, description, suggestion}] }`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Step 2: Cross-file integration pass (uses all per-file findings)
// ✅ CORRECT: Separate pass avoids attention dilution when reviewing many files together.
async function crossFileIntegrationPass(
  files: FileContent[],
  perFileFindings: string[]
): Promise<string> {
  const findingsSummary = perFileFindings
    .map((f, i) => `=== ${files[i].name} ===\n${f}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You have per-file analysis results below. Now identify CROSS-FILE issues only:
- Data flow problems between modules
- Inconsistent error handling patterns across files
- Interface mismatches (function signatures, expected types)
- Missing dependency checks
- Contradictory behavior between files

Per-file findings:
${findingsSummary}

Return: { cross_file_issues: [{files_involved, severity, description, suggestion}] }`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function promptChainingReview(files: FileContent[]): Promise<void> {
  console.log("\n=== Task 1.6A: Prompt Chaining (Code Review) ===");
  console.log(`Reviewing ${files.length} files\n`);

  // ✅ CORRECT: Per-file passes run sequentially or in parallel
  // Each file gets focused attention — no dilution from reviewing 14 files at once
  const perFileFindings: string[] = [];
  for (const file of files) {
    console.log(`  Analyzing: ${file.name}`);
    const finding = await analyzeFileLocally(file);
    perFileFindings.push(finding);
    console.log(`  Done: ${file.name}`);
  }

  // ✅ CORRECT: Separate integration pass after all local passes complete
  console.log("\n  Running cross-file integration pass...");
  const integrationFindings = await crossFileIntegrationPass(files, perFileFindings);

  console.log("\n--- Per-File Findings ---");
  perFileFindings.forEach((f, i) => console.log(`${files[i].name}:\n${f}\n`));
  console.log("--- Cross-File Integration Findings ---");
  console.log(integrationFindings);
}

// ============================================================
// Pattern B: Dynamic Adaptive Decomposition
// Task 1.6 — open-ended investigation tasks
//
// Use when: scope is unknown upfront, each step reveals new subtasks.
// Example: "Add comprehensive tests to a legacy codebase"
// ============================================================

interface InvestigationPlan {
  phase: string;
  subtasks: string[];
  discovered_dependencies: string[];
}

// Phase 1: Map structure before planning
async function mapCodebaseStructure(description: string): Promise<InvestigationPlan> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are investigating a legacy codebase to add comprehensive tests.

Codebase description: ${description}

Phase 1: Map the structure. Generate a prioritized investigation plan:
1. Identify high-impact areas (public APIs, business logic, error paths)
2. List specific subtasks in priority order
3. Note any dependencies between subtasks that will affect sequencing

Return JSON: {
  "phase": "structure_mapping",
  "subtasks": ["specific task 1", "specific task 2", ...],
  "discovered_dependencies": ["dependency 1", "dependency 2", ...]
}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { phase: "unknown", subtasks: [], discovered_dependencies: [] };
  } catch {
    return { phase: "structure_mapping", subtasks: [text], discovered_dependencies: [] };
  }
}

// Phase 2: Execute subtasks, adapting as dependencies are discovered
async function executeAdaptivePlan(
  plan: InvestigationPlan,
  context: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Execute this investigation plan for adding tests to a legacy codebase.
Adapt the plan if you discover new dependencies or complexity along the way.

Plan:
${JSON.stringify(plan, null, 2)}

Codebase context: ${context}

For each subtask:
1. Execute the investigation
2. Note any NEW dependencies discovered
3. Adjust remaining subtasks if needed
4. Produce specific, actionable test recommendations

Return a prioritized test plan with concrete file paths and test scenarios.`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function dynamicDecomposition(codebaseDescription: string): Promise<void> {
  console.log("\n=== Task 1.6B: Dynamic Adaptive Decomposition ===");
  console.log(`Task: Add comprehensive tests to legacy codebase\n`);

  // Step 1: Map structure first — don't plan everything upfront
  console.log("  Phase 1: Mapping codebase structure...");
  const plan = await mapCodebaseStructure(codebaseDescription);
  console.log(`  Discovered ${plan.subtasks.length} subtasks`);
  console.log(`  Dependencies: ${plan.discovered_dependencies.join(", ")}`);

  // Step 2: Execute with adaptation — plan evolves as dependencies are discovered
  console.log("\n  Phase 2: Executing adaptive plan...");
  const testPlan = await executeAdaptivePlan(plan, codebaseDescription);

  console.log("\n--- Generated Test Plan ---");
  console.log(testPlan);
}

// ============================================================
// Run both patterns
// ============================================================

// Pattern A: Prompt chaining for code review
const mockFiles: FileContent[] = [
  {
    name: "auth.ts",
    content: `export function verifyToken(token: string) {
  if (token === "admin") return { userId: 1, role: "admin" };
  return null;
}`,
  },
  {
    name: "orders.ts",
    content: `import { verifyToken } from "./auth";
export function getOrder(token: string, orderId: string) {
  const user = verifyToken(token);
  return { id: orderId, userId: user?.userId };
}`,
  },
];

await promptChainingReview(mockFiles);

// Pattern B: Dynamic decomposition for open-ended task
await dynamicDecomposition(
  "Node.js e-commerce backend, ~8000 lines, no existing tests. " +
  "Key modules: auth, orders, payments, inventory. " +
  "Payment module has known edge cases around partial refunds."
);
