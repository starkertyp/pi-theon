# Design: add-reconciler-classifier-mvp

## Context

Theon's reconciliation phase today is prompt-driven trust: `instructions/orchestrator.md` states "Child summaries alone are not proof" and tells the orchestrator to reconcile child results against actual artifacts, diffs and scope. Nothing systematic enforces this; whether the check happens depends on the orchestrator model's diligence. The MVP adds a typed classifier call as a cheap, repeatable check injected into that existing reconciliation step, entirely via prompt instructions (no extension code).

## Goals / Non-Goals

**Goals**

- Systematic check of every worker/reviewer completion against the brief's acceptance criteria before a final success claim.
- Advisory findings: the orchestrator retains full decision authority (confirm, override with justification, or route back to worker).
- Soft-disable with zero behavior change when no classifier model is configured.
- MVP ships as instructions only, using existing codemode `models.classify` infrastructure.

**Non-Goals**

- Extension-based hard enforcement in `theon.js` (explicitly deferred; see "Deferred").
- Any change to brief format, subagent roles, tools, or configuration surface.
- Router-style task routing decisions by the classifier.

## Decisions

### D1: Reconciler-as-checker, not router

The classifier is used only to evaluate a completed run against explicit criteria, not to decide where work routes next. Rationale:

- Routing decisions need broad session context; serializing that into a cold classifier prompt is expensive and fragile.
- Criteria/diff matching is mechanical: the comparison is between a bounded criteria list and the diff/validation evidence already at hand — exactly what a small typed classifier does well.
- Keeping the classifier's question narrow ("is every criterion backed by evidence?") keeps prompts small and output parseable.

### D2: Classifier input contract

The JSON fed to `models.classify` reuses the existing brief contract — the orchestrator already mandates acceptance criteria, validation commands and expected evidence in every brief, so no new structure is introduced:

- `acceptance_criteria`: the brief's acceptance criteria, expected evidence and validation commands (verbatim from the brief).
- `worker_report`: the worker/reviewer completion summary.
- `diff_validation_summary`: the orchestrator's own reading of the real diff and actual command results (not child summaries).

Question: "Is every criterion backed by evidence from the diff/validation?"

Expected output: `{ "complete": boolean, "gaps": string[] }` where each gap names the unmet criterion and what evidence is missing.

### D3: Advisory, not authoritative

Findings are injected as a required decision item, not as an automatic gate:

- Each reported gap must be explicitly handled: confirmed as a real gap (route corrections back through worker), a justified override (recorded in the final response), or accepted with an explanation.
- The orchestrator remains the decision authority; the classifier cannot block or auto-approve a success claim.
- False positives cost one explanation sentence in the final response — an acceptable price for systematic coverage.

### D4: MVP prompt-driven with soft-disable

- The entire change is one instruction section in `instructions/orchestrator.md`. No extension trigger, no config flag.
- Soft-disable: when `models.getAvailableOfType("classifier")` yields nothing (no classifier configured/available), the reconciler step is skipped silently — behavior is exactly today's. Provider credentials vary, so absence of a classifier is a normal, unexceptional state.
- Error handling per `docs/codemode.md`: `classify()` does not throw on provider errors — the orchestrator must check `stopReason` / `errorMessage` in the result and treat a failed call as "no finding", never as a hard failure of the reconciliation phase.

### D5: Deferred — extension-based enforcement

Hard, un-bypassable enforcement in `theon.js` is explicitly out of scope. It would need role-aware trigger tracking (detecting worker/reviewer completion inside the extension and intercepting success claims), which is significant machinery. Ship the prompt-driven MVP first; add extension enforcement only if the MVP's flags prove useful in practice.

## Risks / Trade-offs

- **Classifier false positives** → cost is one explanation sentence per override (D3); acceptable.
- **Classifier availability varies by provider credentials** → soft-disable keeps current behavior when unavailable (D4).
- **classify() does not throw on provider errors** → orchestrator instructions must require checking `stopReason`/`errorMessage` and degrade to skip, not fail (D4).
- **Prompt-only enforcement can be bypassed by a lazy model** → accepted for MVP; extension enforcement deferred (D5).

## Migration Plan

None. Additive instructions; with no classifier configured, sessions behave identically to today.

## Open Questions

None — all decisions confirmed by the user (soft-disable keeps current state; MVP is prompt-driven; reconciler-as-checker design).