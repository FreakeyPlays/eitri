# Glossary

## Project

A software project that the user works on in Eitri, rooted in one local
directory chosen by the user. Version control is optional.
Use `Project` consistently for this concept.

Its stable ID identifies it; the canonical directory path is unique. The displayed
name defaults to the folder name and can be customized, so two Projects can share
a name. Renaming a Project in Eitri does not rename its directory. Relocating a
Project while preserving its identity is not implemented.

Each client independently selects one Project, and Projects opened before stay
available to switch back to. Every start selects the most recently opened
Project, or none when the collection is empty.

## Project scope

The pages that work inside a Project: overview, manage, wiki and new session.
Without a selected Project they show an introduction that points to the project
menu instead. Settings stay outside the scope.

## Session

One piece of work between the user and an Agent within a Project: the
conversation and its history. One Session is one session of the Agent CLI that
runs it. Use `Session` in product language and code.

Also called Chat (its earlier name in Eitri) or Thread (as in Codex and T3 Code);
both mean the same thing. Don't introduce them as separate concepts.

## Agent

The coding assistant the user interacts with in a Session.
Distinct from the installed tool used to run it, which is the Agent CLI.

## Agent CLI

An installed command-line tool, such as Codex or Claude Code, that Eitri uses
to run an Agent.
