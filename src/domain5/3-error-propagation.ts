/**
 * Task 5.3: Implement Error Propagation Strategies Across Multi-Agent Systems
 *
 * Key concepts tested:
 * - Structured error context enables intelligent coordinator recovery decisions
 * - Access failure (timeout) ≠ valid empty result (0 matches) — must distinguish
 * - Generic "search unavailable" hides context from coordinator
 * - Silently returning empty = anti-pattern; terminating entire workflow = anti-pattern
 *
 * Note: This builds on domain2/2-error-responses.ts (MCP isError flag) —
 * here we focus on the multi-agent coordinator perspective and synthesis coverage annotations.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// ============================================================
// Structured Error Context for Coordinator Recovery
// ============================================================
//
// ❌ BAD: generic status after retries exhausted
//   { "status": "search_unavailable" }
//   → Coordinator has no information for recovery decisions
//   → Cannot retry with modified query, cannot try alternative approach
//   → Cannot include partial results in final output
//
// ✅ GOOD: structured error context with actionable information

interface SubagentErrorContext {
  failure_type: "timeout" | "rate_limit" | "access_denied" | "parse_error" | "no_results";
  attempted_query: string;
  partial_results: unknown[];  // Any results gathered before failure
  attempts_made: number;
  suggested_alternatives: string[];
  is_retryable: boolean;
  topic_coverage_impact: string;  // Which part of the research is now missing
}

interface SubagentSuccess<T> {
  data: T;
  metadata: {
    query: string;
    sources_found: number;
    coverage_notes: string;
  };
}

type SubagentResult<T> = { ok: true; value: SubagentSuccess<T> }
                       | { ok: false; error: SubagentErrorContext };

// ============================================================
// Subagent: Local Recovery Before Propagating
// ============================================================

async function searchWithLocalRecovery(
  query_: string,
  topic: string
): Promise<SubagentResult<{ findings: string[] }>> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Simulate search — in production this calls the actual search tool
      if (Math.random() < 0.3 && attempt < maxRetries) {
        throw new Error("timeout");
      }

      // Success
      return {
        ok: true,
        value: {
          data: { findings: [`Finding about ${topic} from query: ${query_}`] },
          metadata: {
            query: query_,
            sources_found: 3,
            coverage_notes: `Covered main aspects of ${topic}`,
          },
        },
      };
    } catch (err) {
      const isTimeout = String(err).includes("timeout");

      if (isTimeout && attempt < maxRetries) {
        // ✅ LOCAL recovery: retry transient errors within subagent
        console.log(`  [Subagent] Retry ${attempt}/${maxRetries} for query: "${query_}"`);
        await new Promise((r) => setTimeout(r, 500 * attempt));
        continue;
      }

      // Non-retryable or retries exhausted: propagate structured context
      return {
        ok: false,
        error: {
          failure_type: isTimeout ? "timeout" : "parse_error",
          attempted_query: query_,
          partial_results: [],  // Include any partial results gathered before failure
          attempts_made: attempt,
          suggested_alternatives: [
            `Try narrower query: "${topic} statistics 2025"`,
            `Try alternative source: academic databases`,
          ],
          is_retryable: isTimeout,  // Timeout may resolve; access_denied won't
          topic_coverage_impact: `Missing coverage for: ${topic}`,
        },
      };
    }
  }

  return {
    ok: false,
    error: {
      failure_type: "timeout",
      attempted_query: query_,
      partial_results: [],
      attempts_made: maxRetries,
      suggested_alternatives: [`Try at a different time: "${query_}"`],
      is_retryable: true,
      topic_coverage_impact: `No coverage for: ${topic}`,
    },
  };
}

// ============================================================
// Access Failure vs Valid Empty Result
// ============================================================

interface SearchResponse {
  results: unknown[];
  total_found: number;
  query_succeeded: boolean;  // true = search ran; false = search failed
}

function interpretSearchResponse(response: SearchResponse): SubagentResult<{ findings: unknown[] }> {
  if (!response.query_succeeded) {
    // ❌ Access failure: the search itself failed (timeout, auth error)
    // → isError: true — coordinator needs to retry or find alternative
    return {
      ok: false,
      error: {
        failure_type: "access_denied",
        attempted_query: "unknown",
        partial_results: [],
        attempts_made: 1,
        suggested_alternatives: ["Check API key", "Try alternative search provider"],
        is_retryable: false,
        topic_coverage_impact: "Search service unavailable",
      },
    };
  }

  // ✅ Valid empty result: search succeeded, just no matches
  // → isError: false — this is a legitimate outcome (topic has no coverage)
  return {
    ok: true,
    value: {
      data: { findings: response.results },
      metadata: {
        query: "search ran successfully",
        sources_found: response.total_found,
        // Coverage note helps coordinator understand this is a real gap, not a failure
        coverage_notes: response.total_found === 0
          ? "No sources found for this topic — this is a genuine coverage gap"
          : `Found ${response.total_found} sources`,
      },
    },
  };
}

// ============================================================
// Synthesis with Coverage Annotations
// ============================================================
//
// When some subagents fail, the synthesis output should distinguish:
//   - Well-supported findings (multiple sources, successful retrieval)
//   - Findings with coverage gaps (subagent failures, empty results)

interface SynthesisOutput {
  findings: Array<{
    claim: string;
    support_level: "well_supported" | "partially_supported" | "unverified";
    sources: string[];
  }>;
  coverage_gaps: string[];
  reliability_notes: string;
}

function synthesizeWithCoverageAnnotations(
  successfulResults: SubagentSuccess<{ findings: string[] }>[],
  errors: SubagentErrorContext[]
): SynthesisOutput {
  const coverageGaps = errors.map((e) => e.topic_coverage_impact);

  const findings = successfulResults.flatMap((r) =>
    r.data.findings.map((finding) => ({
      claim: finding,
      support_level: "well_supported" as const,
      sources: [r.metadata.query],
    }))
  );

  return {
    findings,
    coverage_gaps: coverageGaps,
    reliability_notes:
      errors.length > 0
        ? `This report has ${errors.length} coverage gap(s) due to subagent failures. ` +
          `Findings marked as 'well_supported' have verified sources. ` +
          `The following topics have insufficient coverage: ${coverageGaps.join("; ")}`
        : "All topics have been researched successfully.",
  };
}

export async function runErrorPropagationDemo(): Promise<void> {
  console.log("\n=== Task 5.3: Error Propagation Across Multi-Agent Systems ===\n");

  const topics = [
    { query: "AI in healthcare 2025", topic: "AI healthcare" },
    { query: "AI in music production 2025", topic: "AI music" },
    { query: "AI regulatory landscape", topic: "AI regulation" },
  ];

  const results = await Promise.all(
    topics.map((t) => searchWithLocalRecovery(t.query, t.topic))
  );

  const successes = results
    .filter((r): r is { ok: true; value: SubagentSuccess<{ findings: string[] }> } => r.ok)
    .map((r) => r.value);

  const errors = results
    .filter((r): r is { ok: false; error: SubagentErrorContext } => !r.ok)
    .map((r) => r.error);

  console.log(`Results: ${successes.length} succeeded, ${errors.length} failed`);

  const synthesis = synthesizeWithCoverageAnnotations(successes, errors);
  console.log("\nSynthesis coverage gaps:", synthesis.coverage_gaps);
  console.log("Reliability notes:", synthesis.reliability_notes);

  if (errors.length > 0) {
    console.log("\nError details for coordinator recovery:");
    errors.forEach((e) => {
      console.log(`  - ${e.failure_type}: ${e.topic_coverage_impact}`);
      console.log(`    Alternatives: ${e.suggested_alternatives[0]}`);
    });
  }
}

await runErrorPropagationDemo();
