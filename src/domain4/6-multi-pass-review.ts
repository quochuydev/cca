/**
 * Task 4.6: Design Multi-Instance and Multi-Pass Review Architectures
 *
 * Key concepts tested:
 * - Self-review limitation: same session retains generation reasoning → anchoring bias
 * - Independent review instance (no prior context) catches more subtle issues
 * - Multi-pass: per-file local passes + separate cross-file integration pass
 * - Verification passes: model self-reports confidence alongside each finding
 *
 * Exam pattern: 14-file PR reviewed in single pass → inconsistent depth, missed bugs
 * Fix: per-file local passes + integration pass (split by scope, not by running it multiple times)
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Self-Review Limitation
// ============================================================
//
// ❌ ANTI-PATTERN: same session that generated code reviews it
//   Session context: "I generated this auth middleware using JWT validation..."
//   Review turn: "Does this auth middleware have any issues?"
//   → Model is anchored to its own reasoning from generation
//   → Less likely to question its own design decisions
//   → Subtle bugs (the kind you only see with fresh eyes) get missed
//
// ✅ CORRECT: independent Claude instance for review
//   Fresh session: no knowledge of how the code was generated
//   → No anchoring bias
//   → More likely to catch: missing edge cases, logic errors, incorrect assumptions
//   → In CI/CD: each pipeline job is always a fresh session (naturally isolated)
//
// Note: "extended thinking" in the same session does NOT solve this —
// the model still has the generation context in its window

// ============================================================
// Multi-Pass Review Architecture
// ============================================================
//
// Problem: reviewing 14 files in a single pass causes:
//   - Attention dilution: model gives shallow treatment to later files
//   - Contradictory findings: flags a pattern in file A, approves same pattern in file B
//   - Missed bugs: obvious issues in the "middle" of the review are skipped
//
// ✅ Solution: split by scope
//   Pass 1 (local): analyze each file individually for local issues
//   Pass 2 (integration): analyze cross-file data flow, interface contracts, circular deps

interface FileReview {
  file: string;
  findings: Finding[];
}

interface Finding {
  line: number;
  severity: "critical" | "high" | "medium" | "low";
  category: "bug" | "security" | "performance";
  issue: string;
  evidence: string;
  suggested_fix: string;
  // ✅ CONFIDENCE FIELD: model self-reports confidence for routing decisions
  confidence: number;  // 0.0 - 1.0
  // ✅ detected_pattern: which code pattern triggered this finding (for false positive analysis)
  detected_pattern: string;
}

interface IntegrationFinding {
  files_involved: string[];
  issue_type: "data_flow" | "interface_mismatch" | "circular_dependency" | "missing_validation";
  description: string;
  severity: "critical" | "high" | "medium";
  confidence: number;
}

// ============================================================
// Pass 1: Per-File Local Analysis
// ============================================================

async function reviewFileLocally(
  filePath: string,
  fileContent: string
): Promise<FileReview> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: `You are a focused code reviewer. Analyze ONLY this single file for:
- Logic bugs and off-by-one errors
- Security vulnerabilities (injection, XSS, auth bypass)
- Null/undefined dereferences

For each finding, include:
- confidence (0.0-1.0): your confidence this is a genuine issue
- detected_pattern: the specific code construct that triggered the finding

Skip: style, naming, cross-file concerns (those go in the integration pass).
Return JSON array of findings.`,
    messages: [
      {
        role: "user",
        content: `File: ${filePath}\n\n\`\`\`typescript\n${fileContent}\n\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Parse findings (simplified — real impl would use tool_use for structured output)
  let findings: Finding[] = [];
  try {
    findings = JSON.parse(text);
  } catch {
    findings = [];
  }

  return { file: filePath, findings };
}

// ============================================================
// Pass 2: Cross-File Integration Analysis
// ============================================================

async function reviewIntegration(
  fileReviews: FileReview[],
  prDiff: string
): Promise<IntegrationFinding[]> {
  // Integration pass receives SUMMARIES of local findings, not full file contents
  // → Focused on cross-file concerns only
  const localSummary = fileReviews
    .map((r) => `${r.file}: ${r.findings.length} local findings`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: `You are reviewing cross-file integration concerns in a pull request.
Focus ONLY on:
- Data flowing between modules with invalid assumptions at boundaries
- Interface mismatches (caller passes X, callee expects Y)
- Circular dependencies introduced by this PR
- Missing validation at module boundaries (trust boundary crossings)

Skip: issues within a single file (those were caught in local passes).
Return JSON array of integration findings.`,
    messages: [
      {
        role: "user",
        content:
          `Local review summary:\n${localSummary}\n\n` +
          `Full PR diff:\n${prDiff}`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    return JSON.parse(text) as IntegrationFinding[];
  } catch {
    return [];
  }
}

// ============================================================
// Confidence-Based Review Routing
// ============================================================
//
// Verification pass: model self-reports confidence alongside each finding
// → Route to different handling based on confidence threshold
//
// confidence >= 0.85: post as inline PR comment automatically
// confidence 0.60-0.84: flag for human reviewer to evaluate
// confidence < 0.60: discard (likely false positive)
//
// ✅ This enables calibrated routing without requiring humans to review everything

function routeFindingsByConfidence(findings: Finding[]): {
  autoPost: Finding[];
  humanReview: Finding[];
  discard: Finding[];
} {
  return {
    autoPost: findings.filter((f) => f.confidence >= 0.85),
    humanReview: findings.filter((f) => f.confidence >= 0.60 && f.confidence < 0.85),
    discard: findings.filter((f) => f.confidence < 0.60),
  };
}

export async function runMultiPassReviewDemo(
  prFiles: Array<{ path: string; content: string }>,
  prDiff: string
): Promise<void> {
  console.log("\n=== Task 4.6: Multi-Pass Review Architecture ===\n");
  console.log(`Reviewing ${prFiles.length} files...\n`);

  // Pass 1: local analysis (parallel — each file is independent)
  const localReviews = await Promise.all(
    prFiles.map((f) => reviewFileLocally(f.path, f.content))
  );

  const totalLocalFindings = localReviews.reduce((sum, r) => sum + r.findings.length, 0);
  console.log(`Pass 1 (local): ${totalLocalFindings} findings across ${prFiles.length} files`);

  // Pass 2: integration analysis (sequential — needs local results)
  const integrationFindings = await reviewIntegration(localReviews, prDiff);
  console.log(`Pass 2 (integration): ${integrationFindings.length} cross-file issues`);

  // Route by confidence
  const allFindings = localReviews.flatMap((r) => r.findings);
  const routed = routeFindingsByConfidence(allFindings);
  console.log(`\nRouting by confidence:`);
  console.log(`  Auto-post (≥0.85): ${routed.autoPost.length}`);
  console.log(`  Human review (0.60-0.84): ${routed.humanReview.length}`);
  console.log(`  Discarded (<0.60): ${routed.discard.length}`);
}

// Demo with stub data
await runMultiPassReviewDemo(
  [
    { path: "src/auth.ts", content: "// auth module" },
    { path: "src/orders.ts", content: "// orders module" },
  ],
  "// diff"
);
