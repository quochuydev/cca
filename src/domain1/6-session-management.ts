/**
 * Task 1.7: Session State, Resumption, and Forking
 *
 * Key concepts tested:
 * - --resume <session-name>: continue a specific prior conversation
 * - fork_session: create independent branches from a shared analysis baseline
 * - When to resume vs start fresh with an injected summary
 * - Informing a resumed session about file changes for targeted re-analysis
 *
 * Exam decision rule:
 * - Resume: prior context is mostly valid, continuing same investigation
 * - Start fresh + summary: prior tool results are stale (files changed significantly)
 * - Fork: exploring divergent approaches from a shared starting point
 */

import {
  query,
  forkSession,
  listSessions,
  getSessionMessages,
} from "@anthropic-ai/claude-agent-sdk";

// ============================================================
// Pattern 1: Session Resumption
// Continue a named investigation session across work sessions.
// ✅ Use when: prior context is mostly valid
// ❌ Avoid when: files have changed significantly (stale tool results)
// ============================================================

export async function demonstrateSessionResumption(): Promise<void> {
  console.log("\n=== Task 1.7: Session Resumption ===");

  let sessionId: string | undefined;

  // Session A: Initial investigation
  console.log("Session A: Initial codebase investigation...");
  for await (const message of query({
    prompt: "Explore the authentication module — understand how tokens are verified and what the flow is.",
    options: {
      cwd: "/Users/silentium/Projects/github/cca",
      allowedTools: ["Read", "Glob", "Grep"],
    },
  })) {
    // ✅ Capture session ID from the init system message
    if (message.type === "system" && message.subtype === "init") {
      sessionId = (message as { session_id?: string }).session_id;
      console.log(`  Session ID captured: ${sessionId}`);
    }
    if ("result" in message) {
      console.log("  Session A complete:", message.result?.slice(0, 200) + "...");
    }
  }

  if (!sessionId) {
    console.log("  (No session ID captured — skipping resume demo)");
    return;
  }

  // Session B: Resume the same session — "it" refers to auth module from prior context
  console.log("\nSession B: Resuming to ask follow-up...");
  for await (const message of query({
    prompt:
      "Now that we've mapped the auth module, find all callers of verifyToken " +
      "across the codebase. I also updated auth.ts to use JWT — please re-analyze that file.",
    // ✅ resume: picks up where Session A left off — full context preserved
    // ✅ CORRECT: Inform the resumed session about file changes for targeted re-analysis
    //    "I also updated auth.ts" → Claude knows to re-read that specific file
    //    Rather than requiring full re-exploration of the entire codebase
    options: {
      resume: sessionId,
      allowedTools: ["Read", "Glob", "Grep"],
    },
  })) {
    if ("result" in message) {
      console.log("  Session B result:", message.result?.slice(0, 200) + "...");
    }
  }
}

// ============================================================
// Pattern 2: Fork Session — Parallel Exploration Branches
// Create independent branches from a shared analysis baseline.
// ✅ Use when: comparing two approaches that diverge from same starting point
// ============================================================

export async function demonstrateForkSession(): Promise<void> {
  console.log("\n=== Task 1.7: Fork Session ===");

  let baseSessionId: string | undefined;

  // Shared baseline: analyze the codebase
  console.log("Baseline: Analyzing codebase structure...");
  for await (const message of query({
    prompt:
      "Analyze the project structure — identify the main modules, their dependencies, " +
      "and the current testing approach.",
    options: {
      cwd: "/Users/silentium/Projects/github/cca",
      allowedTools: ["Read", "Glob", "Grep"],
    },
  })) {
    if (message.type === "system" && message.subtype === "init") {
      baseSessionId = (message as { session_id?: string }).session_id;
    }
    if ("result" in message) {
      console.log("  Baseline complete:", message.result?.slice(0, 150) + "...");
    }
  }

  if (!baseSessionId) {
    console.log("  (No base session ID — skipping fork demo)");
    return;
  }

  // Fork into two branches from the shared baseline
  // ✅ CORRECT: Both branches start from the same analyzed state
  //    Each explores a different approach independently
  console.log(`\nForking session ${baseSessionId} into two branches...`);

  const [forkA, forkB] = await Promise.all([
    forkSession(baseSessionId),
    forkSession(baseSessionId),
  ]);

  console.log(`  Branch A (unit tests): ${forkA.sessionId}`);
  console.log(`  Branch B (integration tests): ${forkB.sessionId}`);

  // Branch A: Explore unit testing strategy
  console.log("\nBranch A: Evaluating unit testing approach...");
  for await (const message of query({
    prompt:
      "Based on the codebase analysis, design a unit testing strategy. " +
      "Focus on isolated module testing with mocks. What coverage would this achieve?",
    options: {
      resume: forkA.sessionId,
      allowedTools: ["Read"],
    },
  })) {
    if ("result" in message) {
      console.log("  Unit test plan:", message.result?.slice(0, 200) + "...");
    }
  }

  // Branch B: Explore integration testing strategy (independent of Branch A)
  console.log("\nBranch B: Evaluating integration testing approach...");
  for await (const message of query({
    prompt:
      "Based on the codebase analysis, design an integration testing strategy. " +
      "Focus on end-to-end flows. What coverage would this achieve vs unit tests?",
    options: {
      resume: forkB.sessionId,
      allowedTools: ["Read"],
    },
  })) {
    if ("result" in message) {
      console.log("  Integration test plan:", message.result?.slice(0, 200) + "...");
    }
  }

  console.log("\n✅ Both branches explored independently from the same baseline.");
  console.log("   Now compare Branch A vs Branch B to choose the best approach.");
}

// ============================================================
// Pattern 3: Resume vs Fresh Session Decision
// ============================================================

export function shouldResumeOrStartFresh(
  lastSessionAge: number,   // hours since last session
  filesChanged: number,     // number of files changed since last session
  totalFiles: number,       // total files in scope
): "resume" | "fresh_with_summary" {
  const staleThresholdHours = 24;
  const staleChangeRatio = 0.3; // >30% of files changed = stale

  const isStale = lastSessionAge > staleThresholdHours;
  const majorChanges = filesChanged / totalFiles > staleChangeRatio;

  if (isStale || majorChanges) {
    // ✅ CORRECT: Start fresh + inject a structured summary
    // Prior tool results reference stale file content — resuming would mislead Claude
    return "fresh_with_summary";
  }

  // ✅ CORRECT: Resume when prior context is mostly valid
  // Inform Claude specifically about changed files for targeted re-analysis
  return "resume";
}

// ============================================================
// Pattern 4: Session History Inspection
// ============================================================

export async function inspectSessionHistory(): Promise<void> {
  console.log("\n=== Task 1.7: Session History ===");

  const sessions = await listSessions();
  console.log(`Found ${sessions.length} past sessions`);

  if (sessions.length > 0) {
    const recent = sessions[0];
    console.log(`Most recent: ${recent.sessionId} in ${recent.cwd}`);

    const messages = await getSessionMessages(recent.sessionId, { limit: 5 });
    console.log(`Last ${messages.length} messages retrieved`);
  }
}

// ============================================================
// Decision guide (exam reference)
// ============================================================

console.log(`
=== Task 1.7: Session Management Decision Guide ===

Resume (--resume <session-id>):
  ✅ Same investigation, same files, picking up from prior work
  ✅ Prior tool results are still valid
  ✅ Inform Claude about specific file changes for targeted re-analysis

Fork (forkSession):
  ✅ Comparing two divergent approaches from a shared analysis baseline
  ✅ Exploring refactoring option A vs option B
  ✅ Two agents investigating the same codebase from different angles

Start fresh + injected summary:
  ✅ Files changed significantly (>30%) since last session
  ✅ Session is stale (>24h) and tool results no longer reflect reality
  ✅ Prior session had many irrelevant detours; fresh start is cleaner

Anti-pattern:
  ❌ Resuming with stale tool results → Claude references old file content
  ❌ Forking when branches aren't actually divergent (just use resume)
`);

// Run demonstrations
await demonstrateSessionResumption();
await demonstrateForkSession();

const decision = shouldResumeOrStartFresh(2, 1, 20);
console.log(`\nDecision (2h old, 1/20 files changed): ${decision}`);

const decision2 = shouldResumeOrStartFresh(30, 8, 20);
console.log(`Decision (30h old, 8/20 files changed): ${decision2}`);
