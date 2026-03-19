/**
 * Task 4.5: Design Efficient Batch Processing Strategies
 *
 * Key concepts tested:
 * - Message Batches API: 50% cost savings, up to 24-hour processing window, no guaranteed latency SLA
 * - Batch = appropriate for non-blocking, latency-tolerant workloads (overnight reports, weekly audits)
 * - Batch = INAPPROPRIATE for blocking workflows (pre-merge checks, real-time responses)
 * - Batch API does NOT support multi-turn tool calling within a single request
 * - custom_id field correlates each request to its response
 *
 * Exam pattern: manager wants to switch ALL workflows to batch for 50% savings
 * Correct answer: batch for overnight reports ONLY; keep synchronous for pre-merge checks
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Batch API: When to Use vs When NOT to Use
// ============================================================
//
// ✅ USE batch API for:
//   - Overnight technical debt reports (generated at 2 AM, reviewed at 9 AM)
//   - Weekly code quality audits
//   - Nightly test generation for recently changed files
//   - Monthly compliance document reviews
//   → Latency doesn't matter: results reviewed hours later
//
// ❌ DO NOT use batch API for:
//   - Pre-merge checks (developer WAITS for result before merging)
//   - Real-time chat responses
//   - Interactive code review sessions
//   - Any workflow where a human is blocked waiting for results
//   → 24-hour max processing time is incompatible with blocking workflows
//
// ❌ BATCH API LIMITATION: no multi-turn tool calling
//   Each batch request is a single prompt → single response
//   Cannot: call a tool mid-request, get results, then continue the conversation
//   Can only: send the full context upfront and receive one structured response

// ============================================================
// custom_id: Correlating Requests to Responses
// ============================================================
//
// The batch API processes requests asynchronously — responses may arrive out of order.
// custom_id is how you match each response back to the original request.
//
// Convention: use meaningful IDs that embed the document identifier
//   custom_id: "review-pr-1234-file-auth.ts"
//   custom_id: "extract-invoice-INV-2026-003"
//   custom_id: "audit-week-2026-03-19-module-payments"

interface DocumentToProcess {
  id: string;
  content: string;
  type: "invoice" | "contract" | "report";
}

// ============================================================
// Submitting a Batch
// ============================================================

async function submitBatch(documents: DocumentToProcess[]): Promise<string> {
  const requests: Anthropic.Messages.MessageCreateParamsNonStreaming[] = documents.map((doc) => ({
    custom_id: `extract-${doc.type}-${doc.id}`,
    params: {
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: "Extract key information from the document. Return JSON only.",
      messages: [
        {
          role: "user" as const,
          content: `Document type: ${doc.type}\n\n${doc.content}`,
        },
      ],
    } as Anthropic.Messages.MessageCreateParamsNonStreaming,
  }));

  // ✅ Prompt refinement BEFORE batch: test on a 5-document sample first
  // → Identify prompt issues on small scale before spending on 1000+ documents
  // → Fix format mismatches, missing fields, schema errors
  // → Maximizes first-pass success rate, minimizes resubmission cost

  console.log(`Submitting batch of ${documents.length} documents...`);

  // In production: const batch = await client.beta.messages.batches.create({ requests });
  const batchId = `batch_${Date.now()}`;  // Simulated
  console.log(`Batch submitted: ${batchId}`);
  console.log("Processing time: up to 24 hours (no guaranteed SLA)");
  return batchId;
}

// ============================================================
// Polling for Batch Completion
// ============================================================

async function pollBatchUntilComplete(batchId: string): Promise<void> {
  console.log(`Polling batch ${batchId}...`);

  // In production:
  // while (true) {
  //   const batch = await client.beta.messages.batches.retrieve(batchId);
  //   if (batch.processing_status === "ended") break;
  //   await new Promise(r => setTimeout(r, 60_000));  // poll every 60s
  // }

  console.log("(Simulated: batch complete)");
}

// ============================================================
// Handling Batch Failures by custom_id
// ============================================================

interface BatchResult {
  custom_id: string;
  result: { type: "succeeded"; message: { content: Anthropic.ContentBlock[] } }
        | { type: "errored"; error: { type: string; message: string } };
}

function processBatchResults(results: BatchResult[]): {
  succeeded: BatchResult[];
  failed: BatchResult[];
} {
  const succeeded = results.filter((r) => r.result.type === "succeeded");
  const failed = results.filter((r) => r.result.type === "errored");

  console.log(`Results: ${succeeded.length} succeeded, ${failed.length} failed`);

  // ✅ Resubmit ONLY failed documents — not the entire batch
  // Use custom_id to identify which documents need resubmission
  for (const failure of failed) {
    console.log(`Failed: ${failure.custom_id}`);
    if (failure.result.type === "errored") {
      const error = failure.result.error;
      // Common failure: document exceeded context limit → chunk and resubmit
      if (error.type === "overloaded_error" || error.message.includes("context")) {
        console.log(`  → Will resubmit chunked version of ${failure.custom_id}`);
      }
    }
  }

  return { succeeded, failed };
}

// ============================================================
// SLA Calculation: Batch Submission Frequency
// ============================================================
//
// Exam pattern: "We have a 30-hour SLA. Batch processing takes up to 24 hours.
//               How often should we submit batches?"
//
// Calculation:
//   Available window = SLA - max_processing_time
//   Available window = 30h - 24h = 6h
//   → Must submit at least every 6 hours
//   → For safety margin: submit every 4 hours
//
// Example:
//   SLA: documents must be processed within 30 hours of receipt
//   Batch max time: 24 hours
//   → Submit new batches every 6 hours (30 - 24 = 6h window)
//   → Documents received at T=0 are submitted no later than T=6h
//   → Completed no later than T=30h ✓

export async function runBatchProcessingDemo(): Promise<void> {
  console.log("\n=== Task 4.5: Batch Processing Strategies ===\n");

  const sampleDocuments: DocumentToProcess[] = [
    { id: "INV-001", content: "Invoice #INV-001...", type: "invoice" },
    { id: "INV-002", content: "Invoice #INV-002...", type: "invoice" },
    { id: "RPT-001", content: "Q1 2026 Report...", type: "report" },
  ];

  console.log("Workflow routing:");
  console.log("  Pre-merge checks → synchronous API (developer is waiting)");
  console.log("  Overnight reports → batch API (50% cost savings, results reviewed next morning)");
  console.log();

  const batchId = await submitBatch(sampleDocuments);
  await pollBatchUntilComplete(batchId);

  // Simulate processing results
  const mockResults: BatchResult[] = [
    {
      custom_id: "extract-invoice-INV-001",
      result: { type: "succeeded", message: { content: [] } },
    },
    {
      custom_id: "extract-invoice-INV-002",
      result: { type: "errored", error: { type: "overloaded_error", message: "context limit" } },
    },
  ];

  processBatchResults(mockResults);

  console.log("\nSLA calculation:");
  console.log("  30h SLA - 24h max batch = 6h submission window");
  console.log("  → Submit new batches every 4h for safety margin");
}

await runBatchProcessingDemo();
