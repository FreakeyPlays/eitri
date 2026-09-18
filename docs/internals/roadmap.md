---
status: accepted
---

# Roadmap

The user confirmed the product scope and delivery order at the close of the
interview. Detailed technical specifications and completion criteria will be
refined during implementation planning for each step.
See the [product vision](product-vision.md) for intent and detailed decisions.
This is a target roadmap, not a report of implemented features. There is no deadline.

## First milestone: useful desktop harness with project guidance

Target: the maintainer's Apple M2 Mac, using the Tauri desktop app.

Agreed scope:

- Local directory projects, with Git optional.
- Immediate chat access without setup of diagrams or project instructions;
  diagrams are optional and recommended.
- Reliable Codex and Claude Code chats organized in a sidebar, with multiple
  chats able to work concurrently without write serialization in a shared
  directory. At chat creation, choose the project directory or, for Git projects,
  a separate worktree; keep that choice visible.
- Inspect changed files and file diffs per working directory or worktree; chats
  sharing a directory show the same changes. First-milestone diffs are limited
  to Git projects; projects without Git remain supported.
- Read and edit project instructions and Markdown documentation; work on
  documentation with an agent while retaining ordinary project files.
- A diagram canvas with component properties and editable source, representing
  responsibilities, technologies, and communication links. Mermaid is preferred,
  subject to verifying graphical editing and source preservation.
- Persist diagrams under `.eitri` and integrate approved architecture into
  project guidance for the selected agent.
- Visually inspect, edit, or comment on agent architecture proposals, then approve
  them before the agent implements the proposed change. This works without Git.
  Comments lead to revised proposals; approval applies to the inspected revision.
- Independent chats, with no automatic broadcast of architecture changes to
  other chats. Chats sharing a directory see the same files when rereading them;
  there are no hidden per-chat guidance copies. Reconcile divergent work when merging.
- On quitting with active runs, offer cancellation or confirmation. Confirming
  stops all active runs and quits; cancelling leaves the app and runs active.
- Resizable panel widths, show/hide controls for views, and saved per-user preferences.

Agreed build order:

1. Establish directory projects, both agent integrations, reliable chat execution
   and persistence, worktree selection, change inspection, and confirmed quit behavior.
2. Add instruction and document editing with provider-aware context integration.
3. Add diagram editing and storage, then architecture proposal review and approval.
4. Complete basic personalization and validate the complete workflow with both
   agents on a real project, including without Git and without a diagram.

Proposed completion scenario: open a local project, express its architecture,
give an agent an implementation request using that guidance, review a proposed
architecture change, revise or comment on it, approve it, and let implementation
proceed. Reopen the app and continue with saved chats and project artifacts.
This demonstrates context delivery and the review workflow; it does not establish
automatic verification of code against diagrams or guarantee model compliance.

Resolve technical questions within the relevant step before implementing it:
chat lifecycle details and change comparison baseline in step 1; provider-specific
context integration in step 2; diagram source constraints, proposal revision
storage, and architecture approval enforcement in step 3; measurable responsiveness
and end-to-end acceptance checks in step 4.

## Next: Kanban view for chats

Add a board as another view of existing chats alongside the sidebar. Column
configuration and movement behavior will be specified before implementation.

## Deferred, without delivery order

- Plugin system.
- MCP configuration UI.
- Automatic text correction, potentially using a local model.
- Locally runnable web distribution through npx.
- Linux release support.
- Mobile access to chats through an Eitri server instance.
- More detailed diagram types and automatic architecture validation.
- A button to bring worktree changes back into the main working directory.
- File diffs for projects without Git; comparison baseline behavior will be
  specified when this capability is pursued.
- Freely composable interfaces and custom workflow automation.

These remain possible extensions, not first-milestone requirements.
