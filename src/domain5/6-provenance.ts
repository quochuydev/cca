/**
 * Task 5.6: Preserve Information Provenance and Handle Uncertainty in Multi-Source Synthesis
 *
 * Key concepts tested:
 * - Source attribution is LOST when findings are compressed without claim-source mappings
 * - Synthesis agent must preserve AND merge claim-source mappings from all subagents
 * - Conflicting statistics from credible sources → annotate with attribution, never pick one
 * - Temporal data: require publication dates to prevent misinterpreting time differences as conflicts
 * - Render content types appropriately: financial data → tables, news → prose, technical → lists
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Claim-Source Mapping: Structure Subagents Must Produce
// ============================================================
//
// ❌ BAD subagent output: plain prose summary
//   "AI adoption in healthcare grew significantly in 2025, with major players like Epic and Cerner
//    deploying AI-assisted diagnostics across 40% of US hospitals."
//   → Source attribution LOST during summarization
//   → Synthesis agent cannot cite sources or verify the 40% figure

interface ClaimSourceMapping {
  claim: string;
  evidence_excerpt: string;   // Exact quote from source
  source_url: string;         // URL or document name
  source_name: string;        // Publication or organization
  publication_date: string;   // ISO 8601 — REQUIRED for temporal interpretation
  confidence: number;         // Source's stated or inferred confidence
  claim_type: "statistic" | "trend" | "event" | "opinion";
}

// ✅ GOOD subagent output: structured claim-source mappings
interface SubagentFindings {
  topic: string;
  claims: ClaimSourceMapping[];
  coverage_gaps: string[];
  methodology_notes: string;  // How claims were gathered (web search, document analysis, etc.)
}

// ============================================================
// Handling Conflicting Statistics from Credible Sources
// ============================================================
//
// ❌ BAD: arbitrarily pick one value
//   Source A says 42% adoption; Source B says 31% adoption
//   → Synthesis picks 42% (larger number, more impressive)
//   → Discards valid data; creates false precision
//
// ✅ CORRECT: annotate conflict with full attribution

interface ConflictAnnotation {
  metric: string;
  values: Array<{
    value: string;
    source: string;
    date: string;
    methodology_note?: string;  // Why values might differ (different definitions, populations)
  }>;
  resolution: "annotated_conflict" | "temporal_difference" | "methodological_difference";
  synthesis_note: string;
}

function detectAndAnnotateConflicts(claims: ClaimSourceMapping[]): {
  unambiguous: ClaimSourceMapping[];
  conflicts: ConflictAnnotation[];
} {
  const statisticsByTopic = new Map<string, ClaimSourceMapping[]>();

  // Group statistics by similar topic
  for (const claim of claims) {
    if (claim.claim_type !== "statistic") continue;
    // Simplified grouping by first 50 chars of claim
    const key = claim.claim.slice(0, 50).toLowerCase();
    if (!statisticsByTopic.has(key)) statisticsByTopic.set(key, []);
    statisticsByTopic.get(key)!.push(claim);
  }

  const conflicts: ConflictAnnotation[] = [];
  const conflictingClaims = new Set<ClaimSourceMapping>();

  for (const [topic, topicClaims] of statisticsByTopic) {
    if (topicClaims.length < 2) continue;

    // Temporal difference: same metric, different dates → not a real conflict
    const dates = topicClaims.map((c) => c.publication_date);
    const allSameYear = dates.every((d) => d.slice(0, 4) === dates[0].slice(0, 4));

    conflicts.push({
      metric: topic,
      values: topicClaims.map((c) => ({
        value: c.claim,
        source: c.source_name,
        date: c.publication_date,
      })),
      resolution: allSameYear ? "annotated_conflict" : "temporal_difference",
      synthesis_note: allSameYear
        ? `Different sources report different values for this metric. ` +
          `Both are included with attribution. Readers should evaluate methodology.`
        : `Values reflect different time periods (${dates.join(" vs ")}). ` +
          `Not a contradiction — use the most recent for current state.`,
    });

    topicClaims.forEach((c) => conflictingClaims.add(c));
  }

  const unambiguous = claims.filter((c) => !conflictingClaims.has(c));
  return { unambiguous, conflicts };
}

// ============================================================
// Synthesis Agent: Preserving Provenance Through Combination
// ============================================================

async function synthesizeWithProvenance(
  findings: SubagentFindings[]
): Promise<string> {
  // Merge all claims from all subagents, preserving their source mappings
  const allClaims = findings.flatMap((f) => f.claims);
  const coverageGaps = findings.flatMap((f) => f.coverage_gaps);

  const { unambiguous, conflicts } = detectAndAnnotateConflicts(allClaims);

  const claimsForSynthesis = JSON.stringify({ unambiguous, conflicts }, null, 2);
  const gapsSection = coverageGaps.length > 0
    ? `\n\nCoverage gaps (topics without sufficient sources):\n${coverageGaps.map((g) => `- ${g}`).join("\n")}`
    : "";

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: `You are a research synthesis specialist. Combine the provided claims into a report.

CRITICAL rules for provenance:
- Preserve ALL source attributions (source_name, source_url, publication_date)
- For conflicting statistics: present BOTH values with their sources — never pick one
- Distinguish well-supported findings (multiple sources) from contested ones
- Include publication dates so readers know how recent each finding is

Rendering rules:
- Financial/statistical data → markdown tables with source columns
- Narrative trends → prose with inline citations [Source Name, Year]
- Technical findings → bulleted lists with file/URL references
- Coverage gaps → explicit section at the end

Do NOT convert everything to a uniform format.`,
    messages: [
      {
        role: "user",
        content: `Claims to synthesize:\n${claimsForSynthesis}${gapsSection}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function runProvenanceDemo(): Promise<void> {
  console.log("\n=== Task 5.6: Information Provenance in Multi-Source Synthesis ===\n");

  // Simulate subagent findings with conflicting statistics
  const webFindings: SubagentFindings = {
    topic: "AI in healthcare",
    claims: [
      {
        claim: "42% of US hospitals deployed AI diagnostics in 2025",
        evidence_excerpt: "...42 percent of surveyed hospitals reported AI-assisted diagnostic tools...",
        source_url: "https://healthtech-report.example.com/2025",
        source_name: "HealthTech Quarterly",
        publication_date: "2025-09-15",
        confidence: 0.85,
        claim_type: "statistic",
      },
      {
        claim: "AI reduces diagnostic time by 30% in radiology",
        evidence_excerpt: "...average reduction of 30% in time-to-diagnosis for radiology cases...",
        source_url: "https://radiology-study.example.com",
        source_name: "Journal of Radiology AI",
        publication_date: "2025-06-01",
        confidence: 0.92,
        claim_type: "statistic",
      },
    ],
    coverage_gaps: ["AI in rural hospitals", "Cost analysis of AI deployments"],
    methodology_notes: "Web search across medical publications and industry reports",
  };

  const docFindings: SubagentFindings = {
    topic: "AI in healthcare",
    claims: [
      {
        // ✅ Conflicting statistic: same metric, different value
        claim: "31% of US hospitals deployed AI diagnostics in 2025",
        evidence_excerpt: "...31 percent deployment rate across accredited hospitals...",
        source_url: "docs/hospital-survey-2025.pdf",
        source_name: "AHA Hospital Survey 2025",
        publication_date: "2025-11-01",
        confidence: 0.90,
        claim_type: "statistic",
      },
    ],
    coverage_gaps: ["AI in outpatient settings"],
    methodology_notes: "Document analysis of industry survey reports",
  };

  const { conflicts } = detectAndAnnotateConflicts([...webFindings.claims, ...docFindings.claims]);
  console.log(`Detected ${conflicts.length} conflicting statistics:`);
  conflicts.forEach((c) => {
    console.log(`  Metric: ${c.metric.slice(0, 50)}...`);
    console.log(`  Resolution: ${c.resolution}`);
    console.log(`  Values: ${c.values.map((v) => `${v.source}: "${v.value.slice(0, 40)}..."`).join("; ")}`);
  });

  console.log("\nSynthesizing with provenance preservation...");
  const report = await synthesizeWithProvenance([webFindings, docFindings]);
  console.log("\nSynthesized report (excerpt):");
  console.log(report.slice(0, 600) + "...");
}

await runProvenanceDemo();
