# Tasks: add-reconciler-classifier-mvp

## 1. Orchestrator instructions (MVP implementation)

- [x] 1.1 Add a reconciler instruction section to `instructions/orchestrator.md`: run a codemode classifier check (`models.getAvailableOfType("classifier")` → `models.classify`) before any final success claim after a worker/reviewer run.
- [x] 1.2 In the same section, specify the classifier input contract (JSON: `acceptance_criteria` from the brief, `worker_report`, `diff_validation_summary`; question "Is every criterion backed by evidence from the diff/validation?"; output `{complete, gaps[]}`).
- [x] 1.3 Specify advisory treatment: findings are non-binding; each gap must be confirmed (route back to worker), overridden with justification, or accepted with an explanation; failed classify calls (check `stopReason`/`errorMessage`, `classify()` does not throw) degrade to "no finding", not an error.
- [x] 1.4 Specify soft-disable wording: if no classifier model is available, reconcile exactly as today with no error.
- [x] 1.5 Keep usage consistent with codemode docs (`docs/codemode.md`); no new tooling, no `theon.js` changes.

## 2. README

- [x] 2.1 If `README.md` describes orchestrator behavior, add a brief mention of the reconciler check and its soft-disable behavior; skip if it does not document orchestrator features.

## 3. Validation

- [x] 3.1 Read the final `instructions/orchestrator.md` end-to-end for style consistency and confirm no contradiction with the existing reconcile paragraph ("Child summaries alone are not proof").
- [x] 3.2 Verify soft-disable behavior in a session without a configured classifier model, if feasible (behavior must be identical to today, no error surfaced).
 _Not feasible in this session: 31 classifier models are available via OpenRouter, so the no-classifier path cannot be exercised._
