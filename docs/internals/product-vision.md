---
status: accepted
---

# Product vision

This document records the ongoing product interview. Confirmed intent describes
the desired product, not implemented behavior. Recommendations and open questions
are not release commitments. Terminology currently follows the
[glossary](glossary.md).

## Confirmed intent

Eitri should let developers give coding agents explicit guidelines and relevant
project context so that generated results better match their intentions. Users
need to express, inspect, and maintain that guidance through the graphical UI,
including project instructions, documentation, and application structure.

Helping the maintainer limit preparation or configuration, sustain motivation,
or start implementation is not the product problem. Those concerns must not be
used to justify product scope or a prescribed workflow.

The initial audience is developers studying or recently graduated, with software
development knowledge and some experience using providers' agent harnesses. They
want to apply practices such as architecture modeling and Kanban to real work.
The maintainer wants this control over AI guidance personally and is the initial
daily user; broader distribution does not impose a release deadline.

Typical projects use web technologies. Eitri should also accommodate projects
using other languages, including Python, Java, Rust, and WebAssembly.

The desired differentiator is useful project knowledge: diagrams that express
application structure, manageable AI context and instructions, and documentation
that agents can use. The agreed release scope is recorded in the
[roadmap](roadmap.md); detailed behavior still has open decisions.
Writing documentation manually currently feels unrewarding to the maintainer.

Eitri is envisioned as an alternative graphical interface for working with
coding agents, with chat management and additional tools such as a UML editor
and editable project instructions. Across multiple chats, the original idea can
drift or disappear from context. An agent may produce working software that
still differs from the intended design.

The user wants diagrams to preserve the intended structure across chats and
wants agents to propose and show plan changes visually. Editing prompts and
context, including AGENTS.md, is part of the desired control. Including a system
diagram in a prompt is one suggested interaction. Automatic verification of code
against diagrams has not been established as a requirement.

## Confirmed architecture review behavior

An agent proposes a change to the planned architecture without replacing the
currently approved design. The user can inspect the proposal visually, edit it,
or comment on it before approving it. The agent may implement the proposed
architecture change only after user approval. This preserves the distinction
between the user's approved intent and the agent's suggested revision.

Comments request a revised proposal rather than granting approval. The agent
revises the proposal and submits it for review again. Approval applies to the
specific revision the user inspected.

For ordinary implementation tasks, the user directs the agent to implement
immediately or plan first through the chat, as in existing harnesses. Eitri
does not impose an additional planning workflow for those tasks. Technical
enforcement and storage of proposal revisions remain undecided.

## Confirmed initial diagram scope

Users can open a directory and start chatting without creating a diagram or
project instructions. Diagrams are optional and recommended; they can be added
later.

The initial editor should describe application components, their responsibilities,
and labeled communication links. The user also wants to record the technology
used by a component. Detailed internal flows and further diagram types can be
considered later. The user wants a graphical canvas with editable properties
and a code editor for viewing and editing the diagram source. Changes should
work in both directions. Mermaid is the user's preferred target representation;
the supported syntax and preservation of source during graphical edits still
need technical evaluation.

Diagrams should be stored in a `.eitri` directory inside the user's project
so they can optionally be versioned with Git. Mermaid is a suggested format,
not a finalized technical choice. Showing changes through Git diffs is a potential interaction;
the visual review experience and proposal storage still need definition.
The user proposes making the diagram persistent project guidance through
AGENTS.md, while leaving the exact integration open to technical advice.
Embedding the diagram versus referencing its file remains undecided. Chats
operate independently: Eitri does not automatically broadcast approved changes
to other chats, interrupt them, or refresh their context. Divergent plans are
reconciled when work is merged. Chats have independent conversation histories
but share the files in their working directory. An agent rereading a changed
diagram or instruction file sees the current file. Eitri does not maintain
hidden per-chat copies of guidance; worktrees provide separate working files.

Technical evidence checked on 2026-09-14: Codex supports project instructions in
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
Claude Code uses [CLAUDE.md and supports importing AGENTS.md](https://code.claude.com/docs/en/memory).
Eitri must account for these provider differences; merely creating AGENTS.md
is not a universal integration. Actual loading in Eitri's adapters is not yet
verified by this interview.

## Confirmed project and instruction management

A Project is rooted in a local directory selected by the user. It does not
require a Git repository; the user chooses whether and how to version it.
Diagram editing and the agreed architecture review workflow must therefore
work without Git. Git diffs can supplement review when Git is available.

Existing project instruction files should be directly editable within Eitri.
Eitri can add a clearly identifiable section with diagram guidance while
preserving the user's other instructions. The exact integration remains subject
to the provider-specific behavior described above.

## Delivery priorities

- The first release targets the Tauri desktop app on the maintainer's Apple M2 Mac.
- Linux is of interest but is not currently a first-release commitment.
- There is no fixed deadline.
- A later web distribution should let friends run Eitri themselves through
  npx without installing the desktop app. This is a distribution intention;
  packaging and prerequisites are unresolved.
- A future mobile client should connect to an Eitri server instance to access
  and manage chats. Desktop feature parity is not the goal, and mobile is outside
  the current focus.

## Documentation and chat organization

The first release should let users read and edit Markdown documentation in their
project and work on it with an agent. Documents remain ordinary project files
usable outside Eitri.

Chats can initially be organized in a sidebar. A subsequent Kanban view should
organize those same chats; a separate task entity is not required by this scope.
The agreed order of delivery and deferred capabilities live in the
[roadmap](roadmap.md).

## Agents, concurrent work, and change inspection

Both Codex and Claude Code are required for the first milestone. When creating
a chat, users choose the project directory or, for Git projects, a separate
worktree as its working directory. That choice remains visible on the chat.

Multiple chats may work concurrently and without an Eitri-imposed write lock
in the same directory, including projects without Git. Separate worktrees are
an optional isolation mechanism. Shared-directory changes can overlap. The change
view belongs to the working directory or worktree: chats sharing a directory
show the same changes, without attributing them to an individual chat.

Users should be able to inspect changed files and file diffs in Eitri.
First-milestone diffs are limited to Git projects. Diffs without Git are deferred,
along with decisions about an Eitri-maintained comparison baseline. Local
directory projects without Git remain supported.

Bringing worktree changes back into the main directory through a button is a
future idea, not a first-milestone requirement.

## Application exit

When the user quits Eitri with active agent runs, the app warns that the runs
will stop and offers cancellation or confirmation. Cancellation keeps the app
and runs active; confirmation stops all active runs before quitting. Continuing
agent execution after the app quits is not part of the first milestone.

## Initial personalization

The first milestone includes resizable panel widths, views that can be shown
or hidden, and saved per-user preferences. Freely composable interfaces and
custom workflow automation are deferred.

## Follow-up specification and technical validation

The product interview has established the intended first-milestone scope. These
questions belong to the relevant implementation specifications; they are not
additional feature commitments:

- Chat foundation: persistence and recovery, cancellation, agent permissions,
  worktree lifecycle, and the Git comparison baseline.
- Guidance integration: file inclusion and loading behavior for both Agent CLIs,
  preserving existing instructions, and making supplied context understandable.
- Diagram editor: supported source syntax, lossless graphical edits, and file
  representation of properties and layout.
- Proposal review: revision storage and the mechanism enforcing approval before
  implementation of a proposed architecture change.
- Release validation: measurable responsiveness checks and an end-to-end scenario
  covering both agents, optional diagrams, independent chats, and app exit.

Automatic detection of code that violates the approved architecture is deferred;
the initial review workflow covers proposed architecture changes.

The user confirmed the consolidated product understanding at the close of the
interview. The roadmap records the agreed scope and delivery order; detailed
technical specifications and acceptance checks will be developed per step.
