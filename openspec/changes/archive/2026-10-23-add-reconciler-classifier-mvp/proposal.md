# Proposal: add-reconciler-classifier-mvp

## Why

Theon's reconciliation phase currently relies on the orchestrator model passively trusting worker/reviewer summaries ("Child summaries alone are not proof" is stated as intent, but nothing enforces it). A cheap, typed classifier model can act as a systematic reconciler: checking worker reports against the acceptance criteria and validation evidence already defined in the brief. This catches missed evidence and unconfirmed success claims before a final success statement is made — at near-zero cost, using the existing codemode `models.classify` infrastructure.

## What Changes

- Add a prompt-driven reconciler step to `instructions/orchestrator.md`: before any final success claim after a worker/reviewer run, the orchestrator runs a codemode classifier check that compares the worker report against the brief's acceptance criteria, expected evidence, and actual validation results.
- The classifier result is advisory: it is injected as a finding the orchestrator must explicitly confirm or act on (override allowed, but override with justification / follow-up routing back to worker).
- Soft-disable: if no classifier model is configured/available via `models.getAvailableOfType("classifier")`, the orchestrator continues exactly as today (no reconciler step, no error).
- No extension (`theon.js`) changes and no new tooling in this MVP — enforcement lives entirely in the orchestrator instructions. Extension-based hard enforcement is explicitly deferred.

## Capabilities

### New Capabilities

- `reconciler-check`: The prompt-driven reconciliation gate — when the orchestrator must run a classifier check before success claims, what input it feeds the classifier (brief acceptance criteria, worker report, real diff/validation results), how results are treated (advisory findings, confirm-or-act), and the soft-disable behavior when no classifier is available.

### Modified Capabilities

(none — no existing specs in `openspec/specs/`)

## Impact

- `instructions/orchestrator.md` — new reconciler instructions section (the only production file changed).
- `README.md` — brief mention of the reconciler behavior, if it documents orchestrator features.
- Runtime behavior: additional codemode `models.classify` call per worker/reviewer completion; usage counted toward session cost (small). No API, dependency, or `theon.js` changes.