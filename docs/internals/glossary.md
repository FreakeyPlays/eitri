# Glossary

## Project

A software project that the user works on in Eitri, rooted in one local
directory chosen by the user. Version control is optional.
Use `Project` consistently for this concept.

Its stable ID identifies it; the canonical directory path is unique. The displayed
name defaults to the folder name and can be customized, so two Projects can share
a name. Renaming a Project in Eitri does not rename its directory. Relocating a
Project while preserving its identity is not implemented.

Each client independently selects one Project or all Projects. The remembered
collection persists, while the selection lasts only for the current window
session: every start begins on all Projects.

## Chat

A conversation between the user and a coding agent within a Project.
Use `Chat` for this conversation in product language.

## Agent

The coding assistant the user interacts with in a Chat.
Distinct from the installed tool used to run it, which is the Agent CLI.

## Agent CLI

An installed command-line tool, such as Codex or Claude Code, that Eitri uses
to run an Agent.
