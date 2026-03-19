/**
 * Task 2.3: Distribute Tools Across Agents & Configure tool_choice
 *
 * Key concepts tested:
 * - Giving an agent 18 tools instead of 4-5 degrades tool selection reliability
 * - Agents with out-of-scope tools (e.g., synthesis agent attempting web searches) misuse them
 * - Scoped tool access: each agent gets only the tools for its role
 * - tool_choice: "auto" (default), "any" (must call a tool), forced { type: "tool", name: "..." }
 *
 * Exam pattern: synthesis agent keeps triggering web searches — fix is to remove WebSearch
 * from its toolset, not to add prompt instructions saying "don't search"
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// ANTI-PATTERN: Too many tools per agent
// ============================================================
// ❌ BAD: Research agent given 18 tools — model's tool selection accuracy drops
// because it must evaluate every tool for every decision.
//
// tools: [
//   search_web, fetch_url, read_file, write_file, run_query, send_email,
//   create_ticket, update_crm, schedule_meeting, post_slack, run_bash,
//   generate_image, translate_text, summarize, extract_data, verify_claim,
//   load_document, check_policy
// ]
//
// ✅ GOOD: 4-5 tightly scoped tools per agent role

// ============================================================
// FIX: Scoped tool sets per agent role
// ============================================================

// Web researcher: only tools needed to find and fetch information
const webResearcherTools: Anthropic.Tool[] = [
  {
    name: "search_web",
    description:
      "Search the web for current information on a topic. " +
      "Returns a list of { title, url, snippet, date }. " +
      "Use for recent news, statistics, and primary sources. " +
      "Do NOT use for document analysis — use load_document for that.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        max_results: { type: "number", description: "Default 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_page",
    description:
      "Fetch the full text content of a specific URL. " +
      "Use after search_web to retrieve full article text. " +
      "Input: a URL from search_web results. " +
      "Do NOT use to load local file paths — that is not supported.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full https:// URL" },
      },
      required: ["url"],
    },
  },
];

// Document analyst: only tools needed to read and verify documents
const documentAnalystTools: Anthropic.Tool[] = [
  // ✅ Replaced generic "fetch_url" with constrained "load_document"
  // load_document validates that the path is a document (not arbitrary URLs)
  {
    name: "load_document",
    description:
      "Load the text content of a local document file (PDF, TXT, DOCX). " +
      "Input: an absolute local file path (must start with /). " +
      "Do NOT pass web URLs here — use search_web and fetch_page for web content.",
    input_schema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to a local document file",
          pattern: "^/",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "verify_claim_against_source",
    description:
      "Check whether a specific claim is supported, contradicted, or absent in a document. " +
      "Input: claim string + document text. " +
      "Output: { verdict: 'supported'|'contradicted'|'absent', evidence_quote: string }.",
    input_schema: {
      type: "object",
      properties: {
        claim: { type: "string" },
        source_document: { type: "string" },
      },
      required: ["claim", "source_document"],
    },
  },
];

// Synthesis agent: NO web search, NO file access
// Scoped cross-role tool: verify_fact for targeted spot-checks only
const synthesisAgentTools: Anthropic.Tool[] = [
  // ✅ Scoped cross-role tool: lets synthesizer spot-check facts without full web access
  {
    name: "verify_fact",
    description:
      "Verify a single specific fact by checking it against a provided source excerpt. " +
      "Use ONLY for quick fact verification of individual claims already in the synthesis. " +
      "For broad research, route back to the coordinator to dispatch the web-researcher.",
    input_schema: {
      type: "object",
      properties: {
        fact: { type: "string" },
        source_excerpt: { type: "string" },
      },
      required: ["fact", "source_excerpt"],
    },
  },
];

// ============================================================
// tool_choice Configuration
// ============================================================

// tool_choice: "auto" (default) — model decides whether to call a tool or respond in text
async function demoAutoToolChoice(): Promise<void> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: webResearcherTools,
    tool_choice: { type: "auto" },  // Model may respond with text instead of a tool call
    messages: [{ role: "user", content: "What year did WWII end?" }],
  });
  console.log(`auto → stop_reason: ${response.stop_reason}`);
  // May return end_turn (text answer) without calling any tool
}

// tool_choice: "any" — GUARANTEES the model calls a tool; prevents conversational responses
// Use when you need structured output, not free-form text
async function demoAnyToolChoice(): Promise<void> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: webResearcherTools,
    tool_choice: { type: "any" },  // Model MUST call one of the available tools
    messages: [{ role: "user", content: "Research the latest AI news" }],
  });
  console.log(`any → stop_reason: ${response.stop_reason}`);
  // Always tool_use — never returns a text-only response
}

// tool_choice: forced — ALWAYS calls a specific named tool first
// Use when a pipeline step must begin with a specific tool (e.g., always extract metadata first)
async function demoForcedToolChoice(): Promise<void> {
  // Pattern: force extract_metadata as the first call, then process in follow-up turns
  const metadataExtractionTool: Anthropic.Tool = {
    name: "extract_metadata",
    description: "Extract document metadata (author, date, title, type) before any other operation.",
    input_schema: {
      type: "object",
      properties: {
        document_text: { type: "string" },
      },
      required: ["document_text"],
    },
  };

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: [metadataExtractionTool, ...documentAnalystTools],
    // ✅ Forced: extract_metadata ALWAYS runs first, regardless of user message
    tool_choice: { type: "tool", name: "extract_metadata" },
    messages: [
      {
        role: "user",
        content: "Analyze this document: 'Annual Report 2025 by Acme Corp...'",
      },
    ],
  });
  console.log(`forced → stop_reason: ${response.stop_reason}`);
  const toolCall = response.content.find((b) => b.type === "tool_use");
  if (toolCall?.type === "tool_use") {
    console.log(`  Called: ${toolCall.name} (forced first step)`);
  }
  // After this turn, subsequent turns use tool_choice: "auto" for remaining steps
}

// ============================================================
// Summary: tool_choice decision guide
// ============================================================
// | Scenario                              | tool_choice setting           |
// |---------------------------------------|-------------------------------|
// | Normal agent reasoning                | "auto" (default)              |
// | Must produce structured output        | "any"                         |
// | Pipeline step must call specific tool | { type: "tool", name: "..." } |

export async function runToolDistributionDemo(): Promise<void> {
  console.log("\n=== Task 2.3: Tool Distribution & tool_choice ===\n");

  console.log("Web researcher tools:", webResearcherTools.map((t) => t.name).join(", "));
  console.log("Document analyst tools:", documentAnalystTools.map((t) => t.name).join(", "));
  console.log("Synthesis agent tools:", synthesisAgentTools.map((t) => t.name).join(", "));
  console.log();

  await demoAutoToolChoice();
  await demoAnyToolChoice();
  await demoForcedToolChoice();
}

await runToolDistributionDemo();
