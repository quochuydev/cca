/**
 * Task 2.4: MCP Server Integration into Claude Code & Agent Workflows
 *
 * Key concepts tested:
 * - Project-level (.mcp.json) for shared team tooling vs user-level (~/.claude.json) for personal
 * - Environment variable expansion (${GITHUB_TOKEN}) in .mcp.json — never commit secrets
 * - All tools from configured MCP servers are discovered at connection time, available simultaneously
 * - MCP resources expose content catalogs (doc hierarchies, schemas) to reduce exploratory tool calls
 *
 * This file documents configuration patterns and demonstrates agent-side MCP tool usage.
 * Config files shown as inline examples — not written to disk in this demo.
 */

// ============================================================
// Project-level MCP config: .mcp.json
// ============================================================
// Committed to the repo — shared by the whole team.
// Use for: GitHub, Jira, internal APIs, shared databases.
// ✅ Environment variable expansion: ${VAR_NAME} — credentials stay in .env, not the repo.
//
// .mcp.json (project root):
// {
//   "mcpServers": {
//     "github": {
//       "command": "npx",
//       "args": ["-y", "@modelcontextprotocol/server-github"],
//       "env": {
//         "GITHUB_TOKEN": "${GITHUB_TOKEN}"
//       }
//     },
//     "internal-api": {
//       "command": "node",
//       "args": ["./mcp-servers/internal-api.js"],
//       "env": {
//         "API_BASE_URL": "${INTERNAL_API_BASE_URL}",
//         "API_KEY": "${INTERNAL_API_KEY}"
//       }
//     }
//   }
// }
//
// ✅ Community server (GitHub) — prefer over custom for standard integrations
// ✅ Custom server (internal-api) — used only for team-specific workflow

// ============================================================
// User-level MCP config: ~/.claude.json
// ============================================================
// NOT committed to git — personal to each developer.
// Use for: experimental tools, personal integrations, local dev utilities.
//
// ~/.claude.json (user home directory):
// {
//   "mcpServers": {
//     "local-db": {
//       "command": "node",
//       "args": ["/Users/dev/tools/local-db-mcp.js"],
//       "env": {
//         "DB_PATH": "/Users/dev/data/dev.sqlite"
//       }
//     },
//     "my-notes": {
//       "command": "npx",
//       "args": ["-y", "mcp-obsidian"],
//       "env": {
//         "VAULT_PATH": "/Users/dev/Documents/ObsidianVault"
//       }
//     }
//   }
// }

// ============================================================
// Tool Discovery at Connection Time
// ============================================================
// When Claude Code starts, it connects to all configured MCP servers.
// Tools from ALL servers are discovered simultaneously and available to the agent.
// The agent does NOT need to "choose" which server to query — it sees all tools at once.
//
// Example: if github MCP exposes create_issue, list_prs, get_file
//      and internal-api exposes search_tickets, update_crm
// → Agent sees all 5 tools as a flat list, picks based on descriptions

// ============================================================
// MCP Tool Description Enhancement
// ============================================================
// Problem: MCP tools often ship with minimal descriptions.
// The agent then defaults to built-in tools (e.g., Grep) even when the MCP tool is more capable.
//
// ❌ BAD (default from MCP server — too generic):
// { name: "search_issues", description: "Search issues." }
// → Agent picks Grep instead because Grep's description is more informative
//
// ✅ GOOD (enhanced in your wrapper / tool registration):
// {
//   name: "search_issues",
//   description:
//     "Search GitHub issues across all repositories in the organization. " +
//     "Supports: label filters, assignee, state (open/closed/all), date ranges. " +
//     "Returns: { number, title, state, labels, assignee, url, created_at }[]. " +
//     "Prefer this over Grep for GitHub issue queries — it queries live GitHub data, " +
//     "not local file contents."
// }

// ============================================================
// MCP Resources: Content Catalogs
// ============================================================
// Resources expose read-only content catalogs so agents can browse available data
// without making exploratory tool calls (which consume tokens + latency).
//
// Example: instead of the agent calling list_projects() → then get_project(id) for each:
//   Resource URI: github://repos/org
//   Content: list of { repo_name, description, default_branch, last_updated }
//
// Agent reads the resource once → knows all available repos → makes targeted tool calls
//
// Other resource examples:
//   - doc://hierarchy          → documentation tree (prevents blind WebFetch exploration)
//   - db://schema              → database tables and columns (prevents schema discovery queries)
//   - jira://project-summaries → project list with statuses

// ============================================================
// Agent Workflow Using MCP Tools
// ============================================================
import { query } from "@anthropic-ai/claude-agent-sdk";

// In a real Claude Code workflow, MCP tools are automatically available
// after .mcp.json configuration. The agent uses them like any other tool.

export async function runMCPIntegrationDemo(): Promise<void> {
  console.log("\n=== Task 2.4: MCP Integration ===\n");

  console.log("Config scopes:");
  console.log("  .mcp.json        → project-level, committed, shared team tooling");
  console.log("  ~/.claude.json   → user-level, NOT committed, personal/experimental");
  console.log();
  console.log("Key rules:");
  console.log("  - Use \${ENV_VAR} in .mcp.json for credentials — never commit raw secrets");
  console.log("  - Prefer community MCP servers (GitHub, Jira) over custom for standard integrations");
  console.log("  - Enhance MCP tool descriptions to prevent agent from defaulting to built-ins");
  console.log("  - Expose content catalogs as MCP resources to reduce exploratory tool calls");
  console.log();

  // Demonstrate: agent using MCP tools via SDK
  // In a real environment, MCP tools appear automatically in the agent's tool list
  for await (const message of query({
    prompt:
      "List the available MCP tools and explain how you would use them for a GitHub issue search task.",
    options: {
      allowedTools: [],  // In production, MCP tools are injected here automatically
    },
  })) {
    if ("result" in message) {
      console.log("Agent response:", message.result);
    }
  }
}

await runMCPIntegrationDemo();
