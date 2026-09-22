# Glossary

## Project

A software project that the user works on in Eitri, rooted in one local
directory chosen by the user. Version control is optional.
Use `Project` consistently for this concept.

Its stable ID identifies it. The canonical directory path stays unique and can
change when the Project moves; the name shown is the folder's own name, so two
Projects can share a name. Each client independently selects one Project or all
Projects, and Projects opened before stay available to switch back to.

## Chat

A conversation between the user and a coding agent within a Project.
Use `Chat` for this conversation in product language.

## Agent

The coding assistant the user interacts with in a Chat.
Distinct from the installed tool used to run it, which is the Agent CLI.

## Agent CLI

An installed command-line tool, such as Codex or Claude Code, that Eitri uses
to run an Agent.
