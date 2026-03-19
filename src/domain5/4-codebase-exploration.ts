/**
 * Task 5.4: Manage Context Effectively in Large Codebase Exploration
 *
 * Key concepts tested:
 * - Context degradation: extended sessions give inconsistent answers, reference "typical patterns"
 * - Scratchpad files persist key findings across context boundaries
 * - Subagent delegation isolates verbose exploration from main coordination context
 * - Structured state (manifests) enables crash recovery without restarting from scratch
 * - /compact reduces context usage when filled with verbose discovery output
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Context Degradation in Extended Sessions
// ============================================================
//
// Symptom: after 30+ turns of codebase exploration, the agent starts:
//   - Saying "typically functions like this would..." instead of referencing the actual code
//   - Contradicting findings from earlier in the session
//   - Forgetting which files were already analyzed
//
// Root cause: early discoveries are "lost in the middle" as new content accumulates
//
// ✅ Solutions:
//   1. Scratchpad files: persist findings to disk, reference them in subsequent prompts
//   2. Subagent delegation: isolate verbose exploration in sub-contexts
//   3. /compact: compress context when it fills with verbose discovery output
//   4. Phase summaries: summarize each exploration phase before starting the next

// ============================================================
// Scratchpad Files: Persisting Key Findings Across Context Boundaries
// ============================================================

const SCRATCHPAD_PATH = "/tmp/codebase-exploration-scratchpad.json";

interface Scratchpad {
  session_id: string;
  last_updated: string;
  key_findings: Array<{
    topic: string;
    finding: string;
    files: string[];
    confidence: "confirmed" | "suspected" | "needs_verification";
  }>;
  analyzed_files: string[];
  pending_questions: string[];
  phase: "discovery" | "analysis" | "implementation";
}

function loadScratchpad(): Scratchpad | null {
  try {
    const content = fs.readFileSync(SCRATCHPAD_PATH, "utf-8");
    return JSON.parse(content) as Scratchpad;
  } catch {
    return null;
  }
}

function saveScratchpad(scratchpad: Scratchpad): void {
  scratchpad.last_updated = new Date().toISOString();
  fs.writeFileSync(SCRATCHPAD_PATH, JSON.stringify(scratchpad, null, 2));
  console.log(`[Scratchpad] Saved ${scratchpad.key_findings.length} findings`);
}

function buildContextWithScratchpad(scratchpad: Scratchpad | null): string {
  if (!scratchpad) return "";

  return `## Previous Exploration Findings (from scratchpad)
Session: ${scratchpad.session_id}
Phase: ${scratchpad.phase}
Files analyzed: ${scratchpad.analyzed_files.join(", ")}

Key findings:
${scratchpad.key_findings.map((f) =>
  `- ${f.topic} [${f.confidence}]: ${f.finding} (in: ${f.files.join(", ")})`
).join("\n")}

Pending questions to answer:
${scratchpad.pending_questions.map((q) => `- ${q}`).join("\n")}

Use these findings as ground truth — do not rely on assumptions about "typical" patterns.`;
}

// ============================================================
// Subagent Delegation: Isolating Verbose Exploration
// ============================================================
//
// Pattern:
//   Main agent (coordinator): preserves high-level understanding, minimal context
//   Subagents: perform verbose exploration, return SUMMARIES only
//
// ❌ BAD: main agent does all exploration itself
//   → 50 Grep results + 20 file reads + dependency traces = filled context
//   → Main agent loses track of high-level coordination
//
// ✅ GOOD: spawn subagents for specific investigation questions

async function exploreWithSubagent(question: string): Promise<string> {
  console.log(`[Subagent] Investigating: "${question}"`);

  let result = "";
  for await (const message of query({
    prompt: `
Investigate this specific question about the codebase:
"${question}"

Use Glob, Grep, and Read to find the answer.
Return a CONCISE summary (max 200 words) with:
- Direct answer to the question
- Key file paths and line numbers
- Any important caveats

Do NOT return verbose Grep output — synthesize into a summary.
`,
    options: {
      allowedTools: ["Glob", "Grep", "Read"],
    },
  })) {
    if ("result" in message) {
      result = message.result;
    }
  }

  return result;
}

// ============================================================
// Phase Summaries: Inject into Next Phase's Initial Context
// ============================================================
//
// Before spawning subagents for a new exploration phase:
//   1. Summarize findings from the completed phase
//   2. Inject that summary into each new subagent's initial context
//   → Subagents start with relevant context, not from scratch

async function runPhasedExploration(codebaseRoot: string): Promise<void> {
  console.log("\n[Phase 1] Discovery: mapping codebase structure");

  // Phase 1: spawn subagents to answer specific discovery questions
  const [authFlowSummary, testFilesSummary] = await Promise.all([
    exploreWithSubagent("What handles authentication? Trace the auth flow from request to response."),
    exploreWithSubagent("Find all test files and their coverage areas."),
  ]);

  // Save phase 1 findings to scratchpad
  const scratchpad: Scratchpad = {
    session_id: `session-${Date.now()}`,
    last_updated: new Date().toISOString(),
    key_findings: [
      {
        topic: "auth_flow",
        finding: authFlowSummary || "Auth flow investigation pending",
        files: ["src/auth.ts"],  // Would be populated from actual subagent output
        confidence: "confirmed",
      },
      {
        topic: "test_coverage",
        finding: testFilesSummary || "Test coverage investigation pending",
        files: ["src/**/*.test.ts"],
        confidence: "confirmed",
      },
    ],
    analyzed_files: ["src/auth.ts", "src/**/*.test.ts"],
    pending_questions: ["Which modules have no test coverage?", "What are the main entry points?"],
    phase: "analysis",
  };
  saveScratchpad(scratchpad);

  // Phase 2: analysis — inject phase 1 summary into context
  console.log("\n[Phase 2] Analysis: deep-dive with phase 1 findings in context");
  const phase1Context = buildContextWithScratchpad(scratchpad);
  console.log("Phase 1 context injected into phase 2 subagents:");
  console.log(phase1Context.slice(0, 200) + "...");
}

// ============================================================
// Crash Recovery: Structured State Manifests
// ============================================================
//
// Long multi-phase exploration can be interrupted (timeout, error, context limit)
// ✅ Design for crash recovery from the start:
//   - Each agent exports state to a known file location after each phase
//   - Coordinator loads the manifest on resume and injects into agent prompts
//   - Agents continue from where they left off, not from scratch

interface ExplorationManifest {
  status: "in_progress" | "phase_complete" | "failed";
  completed_phases: string[];
  current_phase: string;
  phase_outputs: Record<string, unknown>;
  next_actions: string[];
}

function saveManifest(manifest: ExplorationManifest): void {
  fs.writeFileSync("/tmp/exploration-manifest.json", JSON.stringify(manifest, null, 2));
}

function loadManifest(): ExplorationManifest | null {
  try {
    const content = fs.readFileSync("/tmp/exploration-manifest.json", "utf-8");
    return JSON.parse(content) as ExplorationManifest;
  } catch {
    return null;
  }
}

export async function runCodebaseExplorationDemo(): Promise<void> {
  console.log("\n=== Task 5.4: Codebase Exploration Context Management ===\n");

  // Check for existing scratchpad (resume scenario)
  const existing = loadScratchpad();
  if (existing) {
    console.log(`Resuming session ${existing.session_id} from scratchpad`);
    console.log(`Phase: ${existing.phase}, ${existing.key_findings.length} findings loaded`);
    console.log("Context:", buildContextWithScratchpad(existing).slice(0, 200));
  } else {
    console.log("Starting fresh exploration...");
    await runPhasedExploration("/Users/silentium/Projects/github/cca");
  }

  console.log("\nContext management techniques:");
  console.log("  Scratchpad files → persist findings across context boundaries");
  console.log("  Subagent delegation → verbose output stays isolated from main context");
  console.log("  Phase summaries → inject findings into next phase's initial context");
  console.log("  Manifests → crash recovery without restarting from scratch");
  console.log("  /compact → compress context when filled with verbose discovery output");
}

await runCodebaseExplorationDemo();
