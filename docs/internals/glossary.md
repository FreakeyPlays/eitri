# Glossary

## Project

A software project that the user works on in Eitri, rooted in one local
directory chosen by the user. Version control is optional.
Use `Project` consistently for this concept.

Its stable ID identifies it. The canonical directory path stays unique. The name
shown is the folder's own name until the user renames the Project, so two
Projects can share a name. Each client independently selects one Project, and
Projects opened before stay available to switch back to.

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
