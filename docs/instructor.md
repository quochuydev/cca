# Claude Certified Architect – Foundations Certification Exam Guide

## Introduction

The Claude Certified Architect – Foundations certification validates that practitioners can make
informed decisions about tradeoffs when implementing real-world solutions with Claude. This
exam tests foundational knowledge across Claude Code, the Claude Agent SDK, the Claude API,
and Model Context Protocol (MCP) — the core technologies used to build production-grade
applications with Claude.

Questions on this exam are grounded in realistic scenarios drawn from actual customer use
cases, including building agentic systems for customer support, designing multi-agent research
pipelines, integrating Claude Code into CI/CD workflows, building developer productivity tools,
and extracting structured data from unstructured documents. Candidates must demonstrate not
only conceptual knowledge but practical judgment about architecture, configuration, and
tradeoffs in production deployments.

This guide describes the exam content, lists the domains and task statements tested, provides
sample questions, and recommends preparation strategies. Use it alongside hands-on
experience to prepare effectively.

## Target Candidate Description

The ideal candidate for this certification is a solution architect who designs and implements
production applications with Claude. This candidate has hands-on experience with:

- Building agentic applications using the Claude Agent SDK, including multi-agent
  orchestration, subagent delegation, tool integration, and lifecycle hooks
- Configuring and customizing Claude Code for team workflows using CLAUDE.md files,
  Agent Skills, MCP server integrations, and plan mode
- Designing Model Context Protocol (MCP) tool and resource interfaces for backend
  system integration
- Engineering prompts that produce reliable structured output, leveraging JSON schemas,
  few-shot examples, and extraction patterns
- Managing context windows effectively across long documents, multi-turn conversations,
  and multi-agent handoffs

- Integrating Claude into CI/CD pipelines for automated code review, test generation, and
  pull request feedback
- Making sound escalation and reliability decisions, including error handling,
  human-in-the-loop workflows, and self-evaluation patterns

The candidate typically has 6+ months of practical experience building with Claude APIs, Agent
SDK, Claude Code, and MCP, understanding both the capabilities and limitations of large
language models in production environments.

## Exam Content

## Response Types

All questions on the exam are multiple choice format. Each question has one correct response
and three incorrect responses (distractors).

Select the single response that best completes the statement or answers the question.
Distractors are response options that a candidate with incomplete knowledge or experience
might choose.

Unanswered questions are scored as incorrect; there is no penalty for guessing.

## Exam Results

The exam has a pass or fail designation. The exam is scored against a minimum standard
established by subject matter experts.

Your results are reported as a scaled score of 100–1,000. The minimum passing score is 720.
Scaled scoring models help equate scores across multiple exam forms that might have slightly
different difficulty levels.

## Content Outline

This exam guide includes weightings, content domains, and task statements for the exam.

The exam has the following content domains and weightings:

- Domain 1: Agentic Architecture & Orchestration (27% of scored content)
- Domain 2: Tool Design & MCP Integration (18% of scored content)

- Domain 3: Claude Code Configuration & Workflows (20% of scored content)
- Domain 4: Prompt Engineering & Structured Output (20% of scored content)
- Domain 5: Context Management & Reliability (15% of scored content)

## Exam Scenarios

The exam uses scenario-based questions. Each scenario presents a realistic production context
that frames a set of questions. During the exam, 4 scenarios will be presented and picked at
random from the full set of the 6 scenarios below.

### Scenario 1: Customer Support Resolution Agent

You are building a customer support resolution agent using the Claude Agent SDK. The agent
handles high-ambiguity requests like returns, billing disputes, and account issues. It has access
to your backend systems through custom Model Context Protocol (MCP) tools (get_customer,
lookup_order, process_refund, escalate_to_human). Your target is 80%+ first-contact
resolution while knowing when to escalate.

Primary domains: Agentic Architecture & Orchestration, Tool Design & MCP Integration, Context
Management & Reliability

### Scenario 2: Code Generation with Claude Code

You are using Claude Code to accelerate software development. Your team uses it for code
generation, refactoring, debugging, and documentation. You need to integrate it into your
development workflow with custom slash commands, CLAUDE.md configurations, and
understand when to use plan mode vs direct execution.

Primary domains: Claude Code Configuration & Workflows, Context Management & Reliability

### Scenario 3: Multi-Agent Research System

You are building a multi-agent research system using the Claude Agent SDK. A coordinator
agent delegates to specialized subagents: one searches the web, one analyzes documents, one
synthesizes findings, and one generates reports. The system researches topics and produces
comprehensive, cited reports.

Primary domains: Agentic Architecture & Orchestration, Tool Design & MCP Integration, Context
Management & Reliability

### Scenario 4: Developer Productivity with Claude

You are building developer productivity tools using the Claude Agent SDK. The agent helps
engineers explore unfamiliar codebases, understand legacy systems, generate boilerplate code,
and automate repetitive tasks. It uses the built-in tools (Read, Write, Bash, Grep, Glob) and
integrates with Model Context Protocol (MCP) servers.

Primary domains: Tool Design & MCP Integration, Claude Code Configuration & Workflows,
Agentic Architecture & Orchestration

### Scenario 5: Claude Code for Continuous Integration

You are integrating Claude Code into your Continuous Integration/Continuous Deployment
(CI/CD) pipeline. The system runs automated code reviews, generates test cases, and provides
feedback on pull requests. You need to design prompts that provide actionable feedback and
minimize false positives.

Primary domains: Claude Code Configuration & Workflows, Prompt Engineering & Structured
Output

### Scenario 6: Structured Data Extraction

You are building a structured data extraction system using Claude. The system extracts
information from unstructured documents, validates the output using JavaScript Object
Notation (JSON) schemas, and maintains high accuracy. It must handle edge cases gracefully and
integrate with downstream systems.

Primary domains: Prompt Engineering & Structured Output, Context Management & Reliability

## Domain 1: Agentic Architecture & Orchestration

`./domain1.md`

## Domain 2: Tool Design & MCP Integration

`./domain2.md`

## Domain 3: Claude Code Configuration & Workflows

`./domain3.md`

## Domain 4: Prompt Engineering & Structured Output

`./domain4.md`

## Domain 5: Context Management & Reliability

`./domain5.md`

## Sample Questions

The following sample questions illustrate the format and difficulty level of the exam. These are
drawn from the practice test and include explanations to aid learning.

Scenario: Customer Support Resolution Agent

Question 1: Production data shows that in 12% of cases, your agent skips get_customer entirely
and calls lookup_order using only the customer's stated name, occasionally leading to
misidentified accounts and incorrect refunds. What change would most effectively address this
reliability issue?

A) Add a programmatic prerequisite that blocks lookup_order and process_refund calls until
get_customer has returned a verified customer ID. B) Enhance the system prompt to state that
customer verification via get_customer is mandatory before any order operations. C) Add
few-shot examples showing the agent always calling get_customer first, even when customers
volunteer order details. D) Implement a routing classifier that analyzes each request and enables
only the subset of tools appropriate for that request type.

> Correct Answer: A

When a specific tool sequence is required for critical business logic (like verifying customer
identity before processing refunds), programmatic enforcement provides deterministic
guarantees that prompt-based approaches cannot. Options B and C rely on probabilistic LLM
compliance, which is insufficient when errors have financial consequences. Option D addresses
tool availability rather than tool ordering, which is not the actual problem.

Question 2: Production logs show the agent frequently calls get_customer when users ask
about orders (e.g., "check my order #12345"), instead of calling lookup_order. Both tools have
minimal descriptions ("Retrieves customer information" / "Retrieves order details") and accept
similar identifier formats. What's the most effective first step to improve tool selection
reliability?

A) Add few-shot examples to the system prompt demonstrating correct tool selection patterns,
with 5-8 examples showing order-related queries routing to lookup_order. B) Expand each
tool's description to include input formats it handles, example queries, edge cases, and
boundaries explaining when to use it versus similar tools. C) Implement a routing layer that
parses user input before each turn and pre-selects the appropriate tool based on detected
keywords and identifier patterns. D) Consolidate both tools into a single lookup_entity tool
that accepts any identifier and internally determines which backend to query.

> Correct Answer: B

Tool descriptions are the primary mechanism LLMs use for tool selection. When descriptions
are minimal, models lack the context to differentiate between similar tools. Option B directly
addresses this root cause with a low-effort, high-leverage fix. Few-shot examples (A) add token
overhead without fixing the underlying issue. A routing layer (C) is over-engineered and
bypasses the LLM's natural language understanding. Consolidating tools (D) is a valid
architectural choice but requires more effort than a "first step" warrants when the immediate
problem is inadequate descriptions.

Question 3: Your agent achieves 55% first-contact resolution, well below the 80% target. Logs
show it escalates straightforward cases (standard damage replacements with photo evidence)
while attempting to autonomously handle complex situations requiring policy exceptions.
What's the most effective way to improve escalation calibration?

A) Add explicit escalation criteria to your system prompt with few-shot examples demonstrating
when to escalate versus resolve autonomously. B) Have the agent self-report a confidence score
(1-10) before each response and automatically route requests to humans when confidence falls
below a threshold. C) Deploy a separate classifier model trained on historical tickets to predict
which requests need escalation before the main agent begins processing. D) Implement
sentiment analysis to detect customer frustration levels and automatically escalate when
negative sentiment exceeds a threshold.

> Correct Answer: A

Adding explicit escalation criteria with few-shot examples directly addresses the root cause:
unclear decision boundaries. This is the proportionate first response before adding
infrastructure. Option B fails because LLM self-reported confidence is poorly calibrated — the
agent is already incorrectly confident on hard cases. Option C is over-engineered, requiring
labeled data and ML infrastructure when prompt optimization hasn't been tried. Option D solves
a different problem entirely; sentiment doesn't correlate with case complexity, which is the
actual issue.

Scenario: Code Generation with Claude Code

Question 4: You want to create a custom /review slash command that runs your team's
standard code review checklist. This command should be available to every developer when they
clone or pull the repository. Where should you create this command file?

A) In the .claude/commands/ directory in the project repository B) In ~/.claude/commands/
in each developer's home directory C) In the CLAUDE.md file at the project root D) In a
.claude/config.json file with a commands array

> Correct Answer: A

Project-scoped custom slash commands should be stored in the .claude/commands/ directory
within the repository. These commands are version-controlled and automatically available to all
developers when they clone or pull the repo. Option B (~/.claude/commands/) is for personal
commands that aren't shared via version control. Option C (CLAUDE.md) is for project
instructions and context, not command definitions. Option D describes a configuration
mechanism that doesn't exist in Claude Code.

Question 5: You've been assigned to restructure the team's monolithic application into
microservices. This will involve changes across dozens of files and requires decisions about
service boundaries and module dependencies. Which approach should you take?

A) Enter plan mode to explore the codebase, understand dependencies, and design an
implementation approach before making changes. B) Start with direct execution and make
changes incrementally, letting the implementation reveal the natural service boundaries. C) Use
direct execution with comprehensive upfront instructions detailing exactly how each service
should be structured. D) Begin in direct execution mode and only switch to plan mode if you
encounter unexpected complexity during implementation.

> Correct Answer: A

Plan mode is designed for complex tasks involving large-scale changes, multiple valid
approaches, and architectural decisions — exactly what monolith-to-microservices restructuring
requires. It enables safe codebase exploration and design before committing to changes. Option
B risks costly rework when dependencies are discovered late. Option C assumes you already
know the right structure without exploring the code. Option D ignores that the complexity is
already stated in the requirements, not something that might emerge later.

Question 6: Your codebase has distinct areas with different coding conventions: React
components use functional style with hooks, API handlers use async/await with specific error
handling, and database models follow a repository pattern. Test files are spread throughout the
codebase alongside the code they test (e.g., Button.test.tsx next to Button.tsx), and you
want all tests to follow the same conventions regardless of location. What's the most
maintainable way to ensure Claude automatically applies the correct conventions when
generating code?

A) Create rule files in .claude/rules/ with YAML frontmatter specifying glob patterns to
conditionally apply conventions based on file paths B) Consolidate all conventions in the root
CLAUDE.md file under headers for each area, relying on Claude to infer which section applies C)
Create skills in .claude/skills/ for each code type that include the relevant conventions in
their SKILL.md files D) Place a separate CLAUDE.md file in each subdirectory containing that
area's specific conventions

> Correct Answer: A

Option A is correct because .claude/rules/ with glob patterns (e.g., \*\*/\*.test.tsx) allows
conventions to be automatically applied based on file paths regardless of directory
location — essential for test files spread throughout the codebase. Option B relies on inference
rather than explicit matching, making it unreliable. Option C requires manual skill invocation or
relies on Claude choosing to load them, contradicting the need for deterministic "automatic"
application based on file paths. Option D can't easily handle files spread across many directories
since CLAUDE.md files are directory-bound.

Scenario: Multi-Agent Research System

Question 7: After running the system on the topic "impact of AI on creative industries," you
observe that each subagent completes successfully: the web search agent finds relevant articles,
the document analysis agent summarizes papers correctly, and the synthesis agent produces
coherent output. However, the final reports cover only visual arts, completely missing music,
writing, and film production. When you examine the coordinator's logs, you see it decomposed
the topic into three subtasks: "AI in digital art creation," "AI in graphic design," and "AI in
photography." What is the most likely root cause?

A) The synthesis agent lacks instructions for identifying coverage gaps in the findings it receives
from other agents. B) The coordinator agent's task decomposition is too narrow, resulting in
subagent assignments that don't cover all relevant domains of the topic. C) The web search
agent's queries are not comprehensive enough and need to be expanded to cover more creative
industry sectors. D) The document analysis agent is filtering out sources related to non-visual
creative industries due to overly restrictive relevance criteria.

> Correct Answer: B

The coordinator's logs reveal the root cause directly: it decomposed "creative industries" into
only visual arts subtasks (digital art, graphic design, photography), completely omitting music,
writing, and film. The subagents executed their assigned tasks correctly — the problem is what
they were assigned. Options A, C, and D incorrectly blame downstream agents that are working
correctly within their assigned scope.

Question 8: The web search subagent times out while researching a complex topic. You need to
design how this failure information flows back to the coordinator agent. Which error
propagation approach best enables intelligent recovery?

A) Return structured error context to the coordinator including the failure type, the attempted
query, any partial results, and potential alternative approaches. B) Implement automatic retry
logic with exponential backoff within the subagent, returning a generic "search unavailable"
status only after all retries are exhausted. C) Catch the timeout within the subagent and return
an empty result set marked as successful. D) Propagate the timeout exception directly to a
top-level handler that terminates the entire research workflow.

> Correct Answer: A

Structured error context gives the coordinator the information it needs to make intelligent
recovery decisions — whether to retry with a modified query, try an alternative approach, or
proceed with partial results. Option B's generic status hides valuable context from the
coordinator, preventing informed decisions. Option C suppresses the error by marking failure as
success, which prevents any recovery and risks incomplete research outputs. Option D
terminates the entire workflow unnecessarily when recovery strategies could succeed.

Question 9: During testing, you observe that the synthesis agent frequently needs to verify
specific claims while combining findings. Currently, when verification is needed, the synthesis
agent returns control to the coordinator, which invokes the web search agent, then re-invokes
synthesis with results. This adds 2-3 round trips per task and increases latency by 40%. Your
evaluation shows that 85% of these verifications are simple fact-checks (dates, names, statistics)
while 15% require deeper investigation. What's the most effective approach to reduce overhead
while maintaining system reliability?

A) Give the synthesis agent a scoped verify_fact tool for simple lookups, while complex
verifications continue delegating to the web search agent through the coordinator. B) Have the
synthesis agent accumulate all verification needs and return them as a batch to the coordinator
at the end of its pass, which then sends them all to the web search agent at once. C) Give the
synthesis agent access to all web search tools so it can handle any verification need directly
without round-trips through the coordinator. D) Have the web search agent proactively cache
extra context around each source during initial research, anticipating what the synthesis agent
might need to verify.

> Correct Answer: A

Option A applies the principle of least privilege by giving the synthesis agent only what it needs
for the 85% common case (simple fact verification) while preserving the existing coordination
pattern for complex cases. Option B's batching approach creates blocking dependencies since
synthesis steps may depend on earlier verified facts. Option C over-provisions the synthesis
agent, violating separation of concerns. Option D relies on speculative caching that cannot
reliably predict what the synthesis agent will need to verify.

Scenario: Claude Code for Continuous Integration

Question 10: Your pipeline script runs `claude "Analyze this pull request for
security issues"` but the job hangs indefinitely. Logs indicate Claude Code is waiting for
interactive input. What's the correct approach to run Claude Code in an automated pipeline?

A) Add the -p flag: `claude -p "Analyze this pull request for security issues"` B)
Set the environment variable CLAUDE_HEADLESS=true before running the command C)
Redirect stdin from /dev/null: `claude "Analyze this pull request for security
issues" < /dev/null` D) Add the --batch flag: `claude --batch "Analyze this pull
request for security issues"`

> Correct Answer: A

The -p (or --print) flag is the documented way to run Claude Code in non-interactive mode. It
processes the prompt, outputs the result to stdout, and exits without waiting for user
input — exactly what CI/CD pipelines require. The other options reference non-existent features
(CLAUDE_HEADLESS environment variable, --batch flag) or use Unix workarounds that don't
properly address Claude Code's command syntax.

Question 11: Your team wants to reduce API costs for automated analysis. Currently, real-time
Claude calls power two workflows: (1) a blocking pre-merge check that must complete before
developers can merge, and (2) a technical debt report generated overnight for review the next
morning. Your manager proposes switching both to the Message Batches API for its 50% cost
savings. How should you evaluate this proposal?

A) Use batch processing for the technical debt reports only; keep real-time calls for pre-merge
checks. B) Switch both workflows to batch processing with status polling to check for
completion. C) Keep real-time calls for both workflows to avoid batch result ordering issues. D)
Switch both to batch processing with a timeout fallback to real-time if batches take too long.

> Correct Answer: A

The Message Batches API offers 50% cost savings but has processing times up to 24 hours with
no guaranteed latency SLA. This makes it unsuitable for blocking pre-merge checks where
developers wait for results, but ideal for overnight batch jobs like technical debt reports. Option
B is wrong because relying on "often faster" completion isn't acceptable for blocking workflows.
Option C reflects a misconception — batch results can be correlated using custom_id fields.
Option D adds unnecessary complexity when the simpler solution is matching each API to its
appropriate use case.

Question 12: A pull request modifies 14 files across the stock tracking module. Your single-pass
review analyzing all files together produces inconsistent results: detailed feedback for some files
but superficial comments for others, obvious bugs missed, and contradictory feedback — flagging
a pattern as problematic in one file while approving identical code elsewhere in the same PR.
How should you restructure the review?

A) Split into focused passes: analyze each file individually for local issues, then run a separate
integration-focused pass examining cross-file data flow. B) Require developers to split large PRs
into smaller submissions of 3-4 files before the automated review runs. C) Switch to a
higher-tier model with a larger context window to give all 14 files adequate attention in one
pass. D) Run three independent review passes on the full PR and only flag issues that appear in at
least two of the three runs.

> Correct Answer: A

Splitting reviews into focused passes directly addresses the root cause: attention dilution when
processing many files at once. File-by-file analysis ensures consistent depth, while a separate
integration pass catches cross-file issues. Option B shifts burden to developers without
improving the system. Option C misunderstands that larger context windows don't solve
attention quality issues. Option D would actually suppress detection of real bugs by requiring
consensus on issues that may only be caught intermittently.

## Preparation Exercises

Complete these hands-on exercises to build practical familiarity with the topics covered on the
exam. Each exercise is designed to reinforce knowledge across one or more exam domains.

### Exercise 1: Build a Multi-Tool Agent with Escalation Logic

Objective: Practice designing an agentic loop with tool integration, structured error handling,
and escalation patterns.

Steps:

**1. Define 3-4 MCP tools with detailed descriptions that clearly differentiate each tool's**
purpose, expected inputs, and boundary conditions. Include at least two tools with similar
functionality that require careful description to avoid selection confusion.

**2. Implement an agentic loop that checks stop_reason to determine whether to continue**
tool execution or present the final response. Handle both "tool_use" and "end_turn"
stop reasons correctly.

**3. Add structured error responses to your tools: include errorCategory**
(transient/validation/permission), isRetryable boolean, and human-readable
descriptions. Test that the agent handles each error type appropriately (retrying transient
errors, explaining business errors to the user).

**4. Implement a programmatic hook that intercepts tool calls to enforce a business rule (e.g.,**
blocking operations above a threshold amount), redirecting to an escalation workflow
when triggered.

**5. Test with multi-concern messages (e.g., requests involving multiple issues) and verify the**
agent decomposes the request, handles each concern, and synthesizes a unified response.

Domains reinforced: Domain 1 (Agentic Architecture & Orchestration), Domain 2 (Tool Design &
MCP Integration), Domain 5 (Context Management & Reliability)

### Exercise 2: Configure Claude Code for a Team Development Workflow

Objective: Practice configuring CLAUDE.md hierarchies, custom slash commands, path-specific
rules, and MCP server integration for a multi-developer project.

Steps:

**1. Create a project-level CLAUDE.md with universal coding standards and testing**
conventions. Verify that instructions placed at the project level are consistently applied
across all team members.

**2. Create .claude/rules/ files with YAML frontmatter glob patterns for different code**
areas (e.g., paths: ["src/api/**/*"] for API conventions, paths: ["**/*.test.*"]
for testing conventions). Test that rules load only when editing matching files.

**3. Create a project-scoped skill in .claude/skills/ with context: fork and**
allowed-tools restrictions. Verify the skill runs in isolation without polluting the main
conversation context.

**4. Configure an MCP server in .mcp.json with environment variable expansion for**
credentials. Add a personal experimental MCP server in ~/.claude.json and verify both
are available simultaneously.

**5. Test plan mode versus direct execution on tasks of varying complexity: a single-file bug**
fix, a multi-file library migration, and a new feature with multiple valid implementation
approaches. Observe when plan mode provides value.

Domains reinforced: Domain 3 (Claude Code Configuration & Workflows), Domain 2 (Tool
Design & MCP Integration)

### Exercise 3: Build a Structured Data Extraction Pipeline

Objective: Practice designing JSON schemas, using tool_use for structured output,
implementing validation-retry loops, and designing batch processing strategies.

Steps:

**1. Define an extraction tool with a JSON schema containing required and optional fields, an**
enum with an "other" + detail string pattern, and nullable fields for information that may
not exist in source documents. Process documents where some fields are absent and
verify the model returns null rather than fabricating values.

**2. Implement a validation-retry loop: when Pydantic or JSON schema validation fails, send a**
follow-up request including the document, the failed extraction, and the specific
validation error. Track which errors are resolvable via retry (format mismatches) versus
which are not (information absent from source).

**3. Add few-shot examples demonstrating extraction from documents with varied formats**
(e.g., inline citations vs bibliographies, narrative descriptions vs structured tables) and
verify improved handling of structural variety.

**4. Design a batch processing strategy: submit a batch of 100 documents using the Message**
Batches API, handle failures by custom_id, resubmit failed documents with modifications
(e.g., chunking oversized documents), and calculate total processing time relative to SLA
constraints.

**5. Implement a human review routing strategy: have the model output field-level confidence**
scores, route low-confidence extractions to human review, and analyze accuracy by
document type and field to verify consistent performance.

Domains reinforced: Domain 4 (Prompt Engineering & Structured Output), Domain 5 (Context
Management & Reliability)

### Exercise 4: Design and Debug a Multi-Agent Research Pipeline

Objective: Practice orchestrating subagents, managing context passing, implementing error
propagation, and handling synthesis with provenance tracking.

Steps:

**1. Build a coordinator agent that delegates to at least two subagents (e.g., web search and**
document analysis). Ensure the coordinator's allowedTools includes "Task" and that
each subagent receives its research findings directly in its prompt rather than relying on
automatic context inheritance.

**2. Implement parallel subagent execution by having the coordinator emit multiple Task tool**
calls in a single response. Measure the latency improvement compared to sequential
execution.

**3. Design structured output for subagents that separates content from metadata: each**
finding should include a claim, evidence excerpt, source URL/document name, and
publication date. Verify that the synthesis subagent preserves source attribution when
combining findings.

**4. Implement error propagation: simulate a subagent timeout and verify the coordinator**
receives structured error context (failure type, attempted query, partial results). Test that
the coordinator can proceed with partial results and annotate the final output with
coverage gaps.

**5. Test with conflicting source data (e.g., two credible sources with different statistics) and**
verify the synthesis output preserves both values with source attribution rather than
arbitrarily selecting one, and structures the report to distinguish well-established from
contested findings.

Domains reinforced: Domain 1 (Agentic Architecture & Orchestration), Domain 2 (Tool Design &
MCP Integration), Domain 5 (Context Management & Reliability)

## Appendix

### Technologies and Concepts

The following list contains technologies and concepts that might appear on the exam:

- Claude Agent SDK — Agent definitions, agentic loops, stop_reason handling, hooks
  (PostToolUse, tool call interception), subagent spawning via Task tool, allowedTools
  configuration
- Model Context Protocol (MCP) — MCP servers, MCP tools, MCP resources, isError flag,
  tool descriptions, tool distribution, .mcp.json configuration, environment variable
  expansion
- Claude Code — CLAUDE.md configuration hierarchy (user/project/directory),
  .claude/rules/ with YAML frontmatter path-scoping, .claude/commands/ for slash
  commands, .claude/skills/ with SKILL.md frontmatter (context: fork,
  allowed-tools, argument-hint), plan mode, direct execution, /memory command,
  /compact, --resume, fork_session, Explore subagent
- Claude Code CLI — -p / --print flag for non-interactive mode, --output-format
  json, --json-schema for structured CI output
- Claude API — tool_use with JSON schemas, tool_choice options ("auto", "any",
  forced tool selection), stop_reason values ("tool_use", "end_turn"), max_tokens,
  system prompts

- Message Batches API — 50% cost savings, up to 24-hour processing window, custom_id
  for request/response correlation, polling for completion, no multi-turn tool calling
  support
- JSON Schema — Required vs optional fields, enum types, nullable fields, "other" + detail
  string patterns, strict mode for syntax error elimination
- Pydantic — Schema validation, semantic validation errors, validation-retry loops
- Built-in tools — Read, Write, Edit, Bash, Grep, Glob — their purposes and selection
  criteria
- Few-shot prompting — Targeted examples for ambiguous scenarios, format
  demonstration, generalization to novel patterns
- Prompt chaining — Sequential task decomposition into focused passes
- Context window management — Token budgets, progressive summarization,
  lost-in-the-middle effects, context extraction, scratchpad files
- Session management — Session resumption, fork_session, named sessions, session
  context isolation
- Confidence scoring — Field-level confidence, calibration with labeled validation sets,
  stratified sampling for error rate measurement

### In-Scope Topics

The following topics are explicitly tested on the exam:

- Agentic loop implementation: Control flow based on stop_reason, tool result handling,
  loop termination conditions
- Multi-agent orchestration: Coordinator-subagent patterns, task decomposition, parallel
  subagent execution, iterative refinement loops
- Subagent context management: Explicit context passing, structured state persistence,
  crash recovery using manifests
- Tool interface design: Writing effective tool descriptions, splitting vs consolidating tools,
  tool naming to reduce ambiguity
- MCP tool and resource design: Resources for content catalogs, tools for actions,
  description quality for adoption
- MCP server configuration: Project vs user scope, environment variable expansion,
  multi-server simultaneous access
- Error handling and propagation: Structured error responses, transient vs business vs
  permission errors, local recovery before escalation
- Escalation decision-making: Explicit criteria, honoring customer preferences, policy gap
  identification

- CLAUDE.md configuration: Hierarchy (user/project/directory), @import patterns,
  .claude/rules/ with glob patterns
- Custom commands and skills: Project vs user scope, context: fork, allowed-tools,
  argument-hint frontmatter
- Plan mode vs direct execution: Complexity assessment, architectural decisions,
  single-file changes
- Iterative refinement: Input/output examples, test-driven iteration, interview pattern,
  sequential vs parallel issue resolution
- Structured output via tool_use: Schema design, tool_choice configuration, nullable
  fields to prevent hallucination
- Few-shot prompting: Ambiguous scenario targeting, format consistency, false positive
  reduction
- Batch processing: Message Batches API appropriateness, latency tolerance assessment,
  failure handling by custom_id
- Context window optimization: Trimming verbose tool outputs, structured fact extraction,
  position-aware input ordering
- Human review workflows: Confidence calibration, stratified sampling, accuracy
  segmentation by document type and field
- Information provenance: Claim-source mappings, temporal data handling, conflict
  annotation, coverage gap reporting

### Out-of-Scope Topics

The following related topics will NOT appear on the exam:

- Fine-tuning Claude models or training custom models
- Claude API authentication, billing, or account management
- Detailed implementation of specific programming languages or frameworks (beyond
  what's needed for tool and schema configuration)
- Deploying or hosting MCP servers (infrastructure, networking, container orchestration)
- Claude's internal architecture, training process, or model weights
- Constitutional AI, RLHF, or safety training methodologies
- Embedding models or vector database implementation details
- Computer use (browser automation, desktop interaction)
- Vision/image analysis capabilities
- Streaming API implementation or server-sent events
- Rate limiting, quotas, or API pricing calculations
- OAuth, API key rotation, or authentication protocol details

- Specific cloud provider configurations (AWS, GCP, Azure)
- Performance benchmarking or model comparison metrics
- Prompt caching implementation details (beyond knowing it exists)
- Token counting algorithms or tokenization specifics

### Exam Preparation Recommendations

To prepare for this certification exam:

**1. Build an agent with the Claude Agent SDK:** Implement a complete agentic loop with tool
calling, error handling, and session management. Practice spawning subagents and
passing context between them.

**2. Configure Claude Code for a real project:** Set up CLAUDE.md with a configuration
hierarchy, create path-specific rules in .claude/rules/, build custom skills with
frontmatter options (context: fork, allowed-tools), and integrate at least one MCP
server.

**3. Design and test MCP tools:** Write tool descriptions that clearly differentiate similar tools.
Implement structured error responses with error categories and retryable flags. Test tool
selection reliability with ambiguous requests.

**4. Build a structured data extraction pipeline:** Use tool_use with JSON schemas, implement
validation-retry loops, design schemas with optional/nullable fields, and practice batch
processing with the Message Batches API.

**5. Practice prompt engineering techniques:** Write few-shot examples for ambiguous
scenarios. Define explicit review criteria to reduce false positives. Design multi-pass
review architectures for large code reviews.

**6. Study context management patterns:** Practice extracting structured facts from verbose
tool outputs, implementing scratchpad files for long sessions, and designing subagent
delegation to manage context limits.

**7. Review escalation and human-in-the-loop patterns:** Understand when to escalate (policy
gaps, customer requests, inability to progress) versus resolve autonomously. Practice
designing human review workflows with confidence-based routing.

**8. Complete the Practice Exam:** Before sitting for the real exam, complete the practice exam
(the link will be provided separately). The practice exam covers the same scenarios and
question format as the real exam and shows explanations after each answer to help
reinforce your understanding.

Version 0.1 Last Updated: Feb 10 2025
