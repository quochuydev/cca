/**
 * Task 2.1: Design Effective Tool Interfaces
 *
 * Key concepts tested:
 * - Tool descriptions are the PRIMARY mechanism LLMs use for tool selection
 * - Minimal or overlapping descriptions cause misrouting between similar tools
 * - Input formats, examples, edge cases, and boundary explanations belong in descriptions
 * - System prompt keywords can create unintended tool associations
 *
 * Exam pattern: two tools with near-identical descriptions → model routes incorrectly
 * Fix: rename + rewrite descriptions to make purpose unambiguous
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// ANTI-PATTERN: Overlapping tool descriptions cause misrouting
// ============================================================
// ❌ BAD: "analyze_content" and "analyze_document" are indistinguishable to the model
//
// { name: "analyze_content",  description: "Analyzes content for key information." }
// { name: "analyze_document", description: "Analyzes document for key information." }
//
// Result: model picks randomly; ~50% misrouting in production

// ============================================================
// FIX 1: Rename + rewrite to eliminate overlap
// ============================================================
// ✅ GOOD: Renamed "analyze_content" → "extract_web_results" with web-specific description.
// Now each tool's name and description signal a completely different input type.

// ============================================================
// FIX 2: Split a generic tool into purpose-specific tools
// ============================================================
// ❌ BAD: One generic tool doing three things
// { name: "analyze_document", description: "Analyze a document." }
//
// ✅ GOOD: Three tools, each with a single responsibility and defined output contract

const toolsAfterFix: Anthropic.Tool[] = [
  // Renamed from "analyze_content" — web-specific framing eliminates overlap
  {
    name: "extract_web_results",
    description:
      "Extract structured data from web search result pages or HTML content. " +
      "Input: raw HTML or search result JSON from a web fetch. " +
      "Output: array of { title, url, snippet, date }. " +
      "Do NOT use for PDF or local file analysis — use extract_data_points for that. " +
      "Example input: fetch('https://example.com/search?q=...') response body.",
    input_schema: {
      type: "object",
      properties: {
        html_or_json: {
          type: "string",
          description: "Raw HTML or search result JSON from a web page",
        },
      },
      required: ["html_or_json"],
    },
  },

  // Split from generic "analyze_document" — handles structured data extraction
  {
    name: "extract_data_points",
    description:
      "Extract specific data points (numbers, dates, names, identifiers) from a document. " +
      "Input: document text (PDF, Word, plain text). " +
      "Output: { field_name: extracted_value } map with source line references. " +
      "Use when you need values FROM a document, not a summary OF it. " +
      "Do NOT use for web content — use extract_web_results for that.",
    input_schema: {
      type: "object",
      properties: {
        document_text: { type: "string", description: "Full document text" },
        fields_to_extract: {
          type: "array",
          items: { type: "string" },
          description: "Field names to look for (e.g. ['invoice_total', 'due_date'])",
        },
      },
      required: ["document_text", "fields_to_extract"],
    },
  },

  // Split from generic "analyze_document" — handles narrative summarization
  {
    name: "summarize_content",
    description:
      "Produce a concise prose summary of a document's main argument and key points. " +
      "Input: document text. Output: { summary: string, key_points: string[] }. " +
      "Use when you need a SUMMARY, not raw extracted values. " +
      "For extracting specific fields, use extract_data_points instead.",
    input_schema: {
      type: "object",
      properties: {
        document_text: { type: "string" },
        max_words: {
          type: "number",
          description: "Target summary length in words (default 150)",
        },
      },
      required: ["document_text"],
    },
  },

  // Split from generic "analyze_document" — handles claim verification
  {
    name: "verify_claim_against_source",
    description:
      "Check whether a specific claim is supported, contradicted, or absent in a source document. " +
      "Input: claim string + source document text. " +
      "Output: { verdict: 'supported'|'contradicted'|'absent', evidence_quote: string, confidence: number }. " +
      "Use ONLY when validating a claim against a known source. " +
      "Do NOT use for general summarization — use summarize_content for that.",
    input_schema: {
      type: "object",
      properties: {
        claim: { type: "string", description: "The claim to verify" },
        source_document: { type: "string", description: "Document text to check against" },
      },
      required: ["claim", "source_document"],
    },
  },
];

// ============================================================
// System Prompt Keyword Risk
// ============================================================
// ❌ BAD system prompt (keyword-sensitive — creates unintended tool association):
//   "When the user asks about documents, analyze them carefully."
//   → "analyze" + "documents" triggers model to prefer "analyze_document" regardless of context
//
// ✅ GOOD system prompt (tool-agnostic — lets descriptions drive selection):
//   "Use the most appropriate tool based on the input type:
//    web content → extract_web_results, documents → extract_data_points or summarize_content,
//    fact-checking → verify_claim_against_source"

export async function runToolDesignDemo(userMessage: string): Promise<void> {
  console.log("\n=== Task 2.1: Tool Design & Descriptions ===");
  console.log(`User: ${userMessage}\n`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      tools: toolsAfterFix,
      messages,
      // ✅ GOOD: System prompt routes by input type, not by keyword-matched tool name
      system:
        "You are a research assistant. Select tools based on input type: " +
        "web HTML/JSON → extract_web_results; " +
        "extracting values from documents → extract_data_points; " +
        "summarizing documents → summarize_content; " +
        "checking a claim against a source → verify_claim_against_source.",
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      console.log(`\nAssistant: ${text}`);
      break;
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          console.log(`  → Selected tool: ${block.name}`);
          console.log(`    Input: ${JSON.stringify(block.input).slice(0, 100)}...`);
          // Stub result — in production each tool calls its real implementation
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ stub: true, tool: block.name }),
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
  }
}

// Run: asking the model to summarize — should select summarize_content, NOT extract_data_points
await runToolDesignDemo(
  "Here is a report: 'AI adoption in 2025 accelerated across all sectors, " +
  "with healthcare leading at 42% deployment rate...' — give me a brief summary."
);
