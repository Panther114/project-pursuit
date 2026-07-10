# Project Repository Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Project Pursuit workspace a clean, documented Git repository and publish its complete intended project state to GitHub.

**Architecture:** Keep the application source, public assets, offline source files, import scripts, and tests in their current locations. Organize human-facing project documentation under `docs/` with a single index, while keeping `README.md` as the repository entry point. Exclude generated, local, and tool-runtime artifacts from version control.

**Tech Stack:** Git, GitHub CLI, Vite, React, TypeScript, Vitest, Python import scripts.

## Global Constraints

- Preserve source traceability for the offline catalog and its source documents.
- Do not commit `node_modules/`, build output, logs, caches, or Playwright runtime artifacts.
- Delete `AGENTS.md` as explicitly requested; retain product behavior guidance in normal project documentation where it remains relevant.
- Do not add reduced-motion kill switches to the product’s visual effects.
- Use the existing `codex/` branch namespace and do not commit directly to `main`.
- Treat the current project worktree as the intended publish scope, excluding only generated or local-only artifacts.

---

### Task 1: Normalize repository documentation

**Files:**
- Create: `docs/README.md`
- Create: `docs/CONTRIBUTING.md`
- Modify: `README.md`
- Modify: `docs/VERIFICATION_POLICY.md`
- Delete: `AGENTS.md`

**Interfaces:**
- `README.md` links to the documentation index and the development workflow.
- `docs/README.md` indexes product, design, data, and contribution documents.
- `docs/CONTRIBUTING.md` documents install, test, build, source import, and branch expectations.
- `docs/VERIFICATION_POLICY.md` retains the source-confidence and motion-policy guidance needed by maintainers.

- [x] **Step 1: Add the documentation index and contribution guide**

Create `docs/README.md` with links to `CONCEPT.md`, `PRODUCT.md`, `DESIGN.md`, the data documents, the verification policy, and `CONTRIBUTING.md`. Create `docs/CONTRIBUTING.md` with the exact commands `npm install`, `npm test`, `npm run build`, and `npm run import:sources`, plus the rule that source-backed data changes must preserve provenance.

- [x] **Step 2: Update repository navigation and policy documentation**

Update `README.md` so its document section points to `docs/README.md` and its run instructions point to `docs/CONTRIBUTING.md`. Add the project-specific rule that visual effects must remain available regardless of `prefers-reduced-motion`; only non-visual comfort settings may use that media query.

- [x] **Step 3: Remove the requested agent-only file**

Delete `AGENTS.md` after its project-relevant motion and data guidance has been preserved in normal documentation.

- [x] **Step 4: Review documentation links**

Run `rg -n "AGENTS|CONCEPT|PRODUCT|DESIGN|DATA_|IMPORT|VERIFICATION|CONTRIBUTING" README.md docs` and verify every referenced file exists.

### Task 2: Harden repository hygiene

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Git ignores local tool state, editor metadata, Python environments, test caches, and generated runtime files while retaining source inputs and checked-in public assets.

- [x] **Step 1: Extend ignore rules**

Add rules for `.playwright-mcp/`, `.DS_Store`, `Thumbs.db`, `.env`, `.env.*`, `!.env.example`, Python virtual environments, `.mypy_cache/`, `.ruff_cache/`, and common coverage/cache output. Keep `data/` and `public/` tracked because they contain project inputs and runtime assets.

- [x] **Step 2: Verify ignore behavior**

Run `git check-ignore -v .playwright-mcp quickrun.log dist node_modules .env .venv` and verify each local/generated path is ignored.

### Task 3: Validate and publish the repository

**Files:**
- Git metadata: current checkout and `origin` remote

**Interfaces:**
- Current branch remains `codex/cinematic-ui-quickrun`.
- `origin` points to the created or confirmed GitHub repository.
- The pushed commit contains the intended project files and excludes ignored artifacts.

- [x] **Step 1: Run application checks**

Run `npm test` and `npm run build`; stop and report any failure instead of committing a false success.

- [x] **Step 2: Review scope and stage intended files**

Run `git status --short --branch` and `git diff --stat`, then stage the complete intended project state with `git add -A` only after confirming generated artifacts remain ignored.

- [x] **Step 3: Commit the repository setup**

Create one concise commit with `git commit -m "Prepare repository for GitHub"`.

- [x] **Step 4: Create or connect the GitHub repository**

Check `gh repo view Panther114/project-pursuit`. If it exists, add its HTTPS URL as `origin`; otherwise create a private repository with `gh repo create project-pursuit --private --source . --remote origin`.

- [x] **Step 5: Push the branch**

Run `git push -u origin codex/cinematic-ui-quickrun` and verify the remote branch points at the new commit with `git ls-remote --heads origin codex/cinematic-ui-quickrun`.

- [x] **Step 6: Verify final repository state**

Run `git status --short --branch`, `git log -1 --oneline`, `git remote -v`, and `gh repo view --json nameWithOwner,url,defaultBranchRef,isPrivate`; report the exact branch, commit, remote, and validation results.

## Self-review

- Documentation is indexed from one place and the root README remains the entry point.
- The requested `AGENTS.md` removal is explicit and its product-relevant guidance is not silently lost.
- Generated artifacts are excluded without excluding source documents or runtime assets.
- Tests and the production build run before commit and push.
- GitHub publication is verified by remote branch state, not inferred from a successful local commit.

## Execution notes

- `npm test` passed: 6 test files and 10 tests.
- `npm run build` passed with TypeScript and Vite.
- `quickrun.log` could not be deleted because an active local process held the file open; it remains ignored and was not committed.
- The private GitHub repository is `Panther114/project-pursuit` and the published branch is `codex/cinematic-ui-quickrun`.
