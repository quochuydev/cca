/**
 * Task 5.5: Design Human Review Workflows and Confidence Calibration
 *
 * Key concepts tested:
 * - Aggregate accuracy (97% overall) can MASK poor performance on specific segments
 * - Stratified random sampling: measure error rates in high-confidence extractions
 * - Field-level confidence scores calibrated with labeled validation sets
 * - Validate by document type AND field before automating high-confidence extractions
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// ============================================================
// Aggregate Accuracy Masking: The Hidden Risk
// ============================================================
//
// Scenario: invoice extraction system reports 97% accuracy overall
// Seems safe to reduce human review — but examine by segment:
//
// By document type:
//   Standard invoices:   99.2% accuracy   (high volume)
//   Handwritten invoices: 71.3% accuracy  (low volume, masks the average)
//   Multi-currency:       68.5% accuracy  (low volume, masks the average)
//
// By field:
//   vendor_name:    99.8% accuracy
//   invoice_number: 99.1% accuracy
//   total_amount:   95.4% accuracy
//   due_date:       78.2% accuracy  ← significant errors hidden by overall metric
//   tax_breakdown:  61.0% accuracy  ← critical field with very poor accuracy
//
// ✅ Validate accuracy by BOTH document type AND field before automating
//    Never rely on aggregate metrics alone

// ============================================================
// Extraction Tool with Field-Level Confidence
// ============================================================

const extractWithConfidenceTool: Anthropic.Tool = {
  name: "extract_invoice_with_confidence",
  description: "Extract invoice data with field-level confidence scores.",
  input_schema: {
    type: "object",
    properties: {
      vendor_name: { type: "string" },
      vendor_name_confidence: {
        type: "number",
        description: "Confidence 0.0-1.0 that vendor_name is correct",
      },
      invoice_number: { type: "string" },
      invoice_number_confidence: { type: "number" },
      total_amount: { type: "number" },
      total_amount_confidence: { type: "number" },
      due_date: { type: ["string", "null"] },
      due_date_confidence: { type: "number" },
      document_type: {
        type: "string",
        enum: ["standard", "handwritten", "multi_currency", "pro_forma", "other"],
      },
    },
    required: [
      "vendor_name", "vendor_name_confidence",
      "invoice_number", "invoice_number_confidence",
      "total_amount", "total_amount_confidence",
      "due_date", "due_date_confidence",
      "document_type",
    ],
  },
};

interface ExtractionResult {
  vendor_name: string;
  vendor_name_confidence: number;
  invoice_number: string;
  invoice_number_confidence: number;
  total_amount: number;
  total_amount_confidence: number;
  due_date: string | null;
  due_date_confidence: number;
  document_type: string;
}

// ============================================================
// Field-Level Confidence Routing
// ============================================================
//
// After calibrating thresholds using a labeled validation set:
//   Field confidence ≥ 0.92 → auto-approve this field
//   Field confidence 0.75-0.91 → human reviews only this field
//   Field confidence < 0.75 → human reviews entire document
//
// This routes limited reviewer capacity to where it's most needed

interface ReviewDecision {
  autoApprove: string[];   // Fields that can be auto-approved
  reviewField: string[];   // Fields needing individual review
  reviewFull: boolean;     // Whether the full document needs review
  reason: string;
}

// Thresholds calibrated using labeled validation set
// (in production: compute these from actual accuracy measurements)
const THRESHOLDS = {
  autoApprove: 0.92,
  fieldReview: 0.75,
};

function routeForReview(extraction: ExtractionResult): ReviewDecision {
  const fields: Array<{ name: string; confidence: number }> = [
    { name: "vendor_name", confidence: extraction.vendor_name_confidence },
    { name: "invoice_number", confidence: extraction.invoice_number_confidence },
    { name: "total_amount", confidence: extraction.total_amount_confidence },
    { name: "due_date", confidence: extraction.due_date_confidence },
  ];

  const autoApprove: string[] = [];
  const reviewField: string[] = [];
  let reviewFull = false;

  for (const field of fields) {
    if (field.confidence >= THRESHOLDS.autoApprove) {
      autoApprove.push(field.name);
    } else if (field.confidence >= THRESHOLDS.fieldReview) {
      reviewField.push(field.name);
    } else {
      // Low confidence on any field → full document review
      reviewFull = true;
    }
  }

  // ✅ Ambiguous/contradictory source → always full review regardless of confidence
  const isHandwritten = extraction.document_type === "handwritten";
  if (isHandwritten) {
    reviewFull = true;
  }

  return {
    autoApprove,
    reviewField,
    reviewFull,
    reason: reviewFull
      ? isHandwritten
        ? "Handwritten document — always requires human review"
        : "One or more fields have confidence below field-review threshold"
      : reviewField.length > 0
        ? `${reviewField.length} field(s) need review`
        : "All fields auto-approved",
  };
}

// ============================================================
// Stratified Random Sampling for Ongoing Quality Measurement
// ============================================================
//
// Problem: once you automate high-confidence extractions, you stop seeing their errors
// → Novel error patterns emerge without warning
// → Accuracy may silently degrade over time
//
// ✅ Solution: stratified random sampling
//   Sample 5% of high-confidence extractions for human review
//   Sample more from low-volume / high-risk segments (handwritten, multi-currency)
//   → Catches novel error patterns before they accumulate
//   → Measures ACTUAL accuracy on the auto-approved population

function selectForSampling(
  extractions: ExtractionResult[],
  sampleRate = 0.05
): ExtractionResult[] {
  return extractions.filter((extraction) => {
    // ✅ Oversample high-risk segments regardless of confidence
    if (extraction.document_type === "handwritten") return Math.random() < 0.20;
    if (extraction.document_type === "multi_currency") return Math.random() < 0.15;

    // Standard random sampling for normal documents
    return Math.random() < sampleRate;
  });
}

// ============================================================
// Calibrating Thresholds with Labeled Validation Set
// ============================================================
//
// Process:
//   1. Extract 1000 documents with confidence scores
//   2. Have humans label correct answers for all 1000
//   3. For each confidence bucket (0.90-0.95, 0.95-0.99, etc.):
//      measure actual accuracy
//   4. Set autoApprove threshold where actual accuracy ≥ your target (e.g., 99.5%)
//   5. Set fieldReview threshold where accuracy ≥ acceptable-with-review (e.g., 90%)
//
// This ensures thresholds reflect ACTUAL model performance, not stated confidence

export async function runHumanReviewDemo(): Promise<void> {
  console.log("\n=== Task 5.5: Human Review Workflows & Confidence Calibration ===\n");

  const documentText = `
INVOICE #INV-2026-555
From: Acme Supplies Ltd.
Date: March 19, 2026

Total: $1,250.00
Payment due: April 18, 2026`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    tools: [extractWithConfidenceTool],
    tool_choice: { type: "tool", name: "extract_invoice_with_confidence" },
    system: "Extract invoice data with honest confidence scores. " +
            "Use 0.0-1.0 for each field: 1.0 = certain, 0.5 = uncertain.",
    messages: [{ role: "user", content: documentText }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (toolUse) {
    const extraction = toolUse.input as ExtractionResult;
    const decision = routeForReview(extraction);

    console.log("Extraction:");
    console.log(`  vendor_name: "${extraction.vendor_name}" (conf: ${extraction.vendor_name_confidence})`);
    console.log(`  total_amount: ${extraction.total_amount} (conf: ${extraction.total_amount_confidence})`);
    console.log(`  due_date: ${extraction.due_date} (conf: ${extraction.due_date_confidence})`);
    console.log();
    console.log("Review routing decision:");
    console.log(`  Auto-approve: ${decision.autoApprove.join(", ") || "none"}`);
    console.log(`  Field review: ${decision.reviewField.join(", ") || "none"}`);
    console.log(`  Full review: ${decision.reviewFull}`);
    console.log(`  Reason: ${decision.reason}`);
  }

  console.log("\nStratified sampling approach:");
  console.log("  5% of standard documents → ongoing accuracy measurement");
  console.log("  20% of handwritten → oversample high-risk segment");
  console.log("  15% of multi-currency → oversample high-risk segment");
}

await runHumanReviewDemo();
