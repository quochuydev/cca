/**
 * Tasks 1.2 & 1.3: Multi-Agent Coordinator-Subagent Pattern
 *
 * Key concepts tested:
 * - Hub-and-spoke: coordinator manages all inter-subagent communication
 * - Subagents have ISOLATED context — they don't inherit coordinator history
 * - allowedTools MUST include "Agent" for coordinator to spawn subagents
 * - Parallel subagents: emit multiple Task tool calls in a SINGLE coordinator response
 * - Coordinator prompt specifies goals + quality criteria, not step-by-step procedures
 * - Partition scope across subagents to minimize duplication
 * - Iterative refinement: coordinator re-delegates if synthesis has gaps
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// --- Subagent Definitions ---
// Each subagent has a narrow, well-defined role with scoped tool access.
// ✅ CORRECT: Tool sets are restricted to each agent's specialization.
const agents = {
  "web-searcher": {
    description:
      "Searches the web for current information on a research topic. " +
      "Use for: recent news, statistics, primary sources. " +
      "Do NOT use for document analysis — use document-analyzer for that.",
    prompt: `You are a web research specialist.
Your job: search for information on the topic given to you and return structured findings.

Return a JSON object:
{
  "findings": [{ "claim": string, "source_url": string, "date": string, "excerpt": string }],
  "gaps": string[],
  "subtopics_covered": string[]
}

Rules:
- Include publication dates for all sources
- If two sources conflict, include BOTH with a "conflict" flag — do not resolve it yourself
- Note any subtopics you could not find adequate sources for in "gaps"`,
    tools: ["WebSearch", "WebFetch"],
  },

  "document-analyzer": {
    description:
      "Analyzes documents provided in the prompt for specific information. " +
      "Use for: extracting data from supplied text, not for web searches.",
    prompt: `You are a document analysis specialist.
Your job: extract structured data from documents provided in your prompt.

Return a JSON object:
{
  "findings": [{ "claim": string, "document": string, "section": string, "quote": string }],
  "gaps": string[]
}

Rules:
- Preserve exact quotes for key claims
- Note page or section references
- Flag contradictions between documents — do not resolve them`,
    tools: ["Read"],
  },

  synthesizer: {
    description:
      "Synthesizes findings from web-searcher and document-analyzer into a comprehensive report. " +
      "MUST be invoked AFTER receiving findings from other agents. " +
      "Do NOT call this before search and analysis are complete.",
    prompt: `You are a research synthesis specialist.
Your job: combine provided findings into a well-structured report.

Rules:
- Preserve ALL source attributions (URLs, document names, dates)
- Distinguish well-supported findings from contested ones
- Annotate conflicts — do not arbitrarily pick one side
- Explicitly note coverage gaps
- Use tables for data, prose for narrative, lists for technical findings`,
    tools: [],
  },
};

// --- Coordinator ---
// ✅ CORRECT: Coordinator prompt specifies research goals + quality criteria.
// It does NOT give step-by-step instructions — subagents decide HOW to execute.
export async function runResearchPipeline(topic: string): Promise<void> {
  console.log("\n=== Tasks 1.2 & 1.3: Multi-Agent Research System ===");
  console.log(`Topic: ${topic}\n`);

  const coordinatorPrompt = `
Research the following topic comprehensively: "${topic}"

Your responsibilities as coordinator:
1. Analyze the topic scope and determine which subtopics need coverage
2. Spawn web-searcher and document-analyzer IN PARALLEL — emit both Agent tool calls
   in a single response to minimize latency
3. Pass the COMPLETE findings from both agents directly into the synthesizer prompt.
   Synthesizer has no memory of prior agents — you must include everything explicitly.
4. Evaluate the synthesized report for coverage gaps
5. If gaps remain, re-delegate targeted queries to web-searcher and re-invoke synthesizer

Quality criteria:
- All major subtopics of "${topic}" must be covered
- Every claim must have source attribution
- Conflicting data must be flagged, not resolved
- Final report must distinguish established facts from contested findings

Begin by spawning the research agents in parallel.
`;

  for await (const message of query({
    prompt: coordinatorPrompt,
    options: {
      // ✅ CRITICAL: "Agent" must be in allowedTools for coordinator to spawn subagents
      allowedTools: ["Agent"],
      agents,
    },
  })) {
    if ("result" in message) {
      console.log("\n--- Final Report ---");
      console.log(message.result);
    } else if (message.type === "assistant") {
      // Show coordinator reasoning steps
      console.log("[Coordinator step]");
    }
  }
}

// --- Risk: Overly Narrow Task Decomposition (Exam Pitfall) ---
// ❌ BAD: Coordinator decomposes "impact of AI on creative industries" into only:
//   - "AI in digital art creation"
//   - "AI in graphic design"
//   - "AI in photography"
//   → Result: misses music, writing, film — subagents execute correctly but scope is wrong
//
// ✅ GOOD: Coordinator first maps the full topic space:
//   - "AI in visual arts (digital art, graphic design, photography)"
//   - "AI in music composition and production"
//   - "AI in writing and journalism"
//   - "AI in film production and VFX"

// Run example
await runResearchPipeline("impact of AI on creative industries");
