# Working agreement

## Git: the user owns commits

- Never create a commit by default. Do not run `git commit`, `git commit --amend`, `git rebase`, `git push`, or any other history-changing command unless the user explicitly instructs it.
- Do not stage files with `git add` as part of normal implementation work. Leave changes in the working tree so the user can review them.
- The user reviews and creates commits. If a commit is explicitly requested, confirm the intended scope first and commit only the reviewed files.
- Never rewrite, squash, reset, or force-push history unless the user explicitly asks for that exact operation.

## Code comments

- Do not add unnecessary comments. Clear names and small functions are preferred over explanatory noise.
- Comments should describe the high- or medium-level objective of a function, module, or non-obvious decision.
- Do not narrate obvious code, restate names or types, or write multi-line blocks that repeat the implementation.
- Keep comments short: usually one or two lines explaining why the code exists or what invariant it protects.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
