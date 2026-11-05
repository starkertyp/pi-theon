## 1. Extension configuration handling (`extensions/theon.js`)

- [x] 1.1 Read merged Pi settings via `pi.getSettings()` when composing the prompt at `before_agent_start` and extract `theon.classifier`; rely on existing host precedence (project `.pi/settings.json` over host global `~/.pi/agent/settings.json`) and consume the host's current merged snapshot at each prompt composition — when disk changes become visible (reload/restart) is governed by Pi; no caching, watchers, or hot-reload machinery of Theon's own.
- [x] 1.2 Parse the value per the strict shape: missing or `false` → classifier disabled (no diagnostic); object with nonempty string `provider` and `model` → enabled with exactly that pair; anything else (including `true`) → invalid.
- [x] 1.3 On invalid configuration, surface a visible diagnostic when it is detected via the existing `ctx.ui.notify` channel, naming the invalid value and the required shape; disable the classifier only — leave Theon orchestration, delegation, and the edit/write block unchanged; never write settings files.
- [x] 1.4 Make the injected prompt conditional: include the classifier instruction block only when the classifier is enabled, with the configured provider/model inserted; Theon off keeps suppressing the entire injection (classifier included); child sessions stay inert via the existing `PI_SUBAGENT_CHILD` rule; add no model invocation, success-claim detection, or enforcement.

## 2. Orchestrator instructions (`instructions/orchestrator.md`)

- [x] 2.1 Restructure the classifier section into a conditionally injected, separately delimited block; remove the unconditional "Before any final success claim … run a codemode classifier check" trigger for disabled sessions while keeping the trigger wording for enabled sessions.
- [x] 2.2 Replace `models.getAvailableOfType("classifier")` → "pick a model" with `models.getModelOfType("classifier", provider, model)` for the configured pair; state explicitly that no other, auto-selected, or substitute model may be used.
- [x] 2.3 Specify the skip semantics: configured model unavailable, classify invocation failed (check `stopReason`/`errorMessage`; `classify()` does not throw), or codemode capability absent → visibly report the skipped check in the final response, no fallback, no abort, no configuration mutation, no permanent disable; the next eligible check may retry.
- [x] 2.4 Keep unchanged and re-verify: trigger timing (before any final success claim after a worker/reviewer run), input contract (`acceptance_criteria`, `worker_report`, `diff_validation_summary`), question "Is every criterion backed by evidence from the diff/validation?", expected output `{complete, gaps[]}`, advisory non-binding findings, and explicit gap resolution (confirm and route back through worker, override with justification, or accept with explanation).
- [x] 2.5 Keep the mandatory plain reconciliation paragraph intact and explicit for all three cases (classifier disabled, succeeded, failed): the orchestrator always reconciles child results with the real diff and actual validation evidence.

## 3. Tests (`test/theon.test.js`)

- [x] 3.1 Extend the harness test double with a `getSettings` stub that returns a per-test merged-settings object; change nothing else in the double.
- [x] 3.2 Default off: no `theon.classifier` key → injected prompt contains no classifier instructions; update the existing prompt regex assertions that currently assume the unconditional classifier block.
- [x] 3.3 Enabled exact selection: valid `{provider, model}` → prompt contains the classifier block naming exactly the configured provider and model and referencing `getModelOfType`, not `getAvailableOfType`/pick-any.
- [x] 3.4 Precedence at the merge boundary: merged value `false` over a global object → disabled; merged project object over a global object → enabled with the project model (host merge itself belongs to Pi; the extension only consumes the merged result).
- [x] 3.5 Theon off: `/theon off` → no prompt injection at all and no classifier instructions (existing off-assertions must stay green).
- [x] 3.6 Invalid config: `true`, numeric/array values, object with missing/empty/non-string `provider` or `model` → visible diagnostic notice, no classifier block in the prompt, Theon sections and the edit/write block unchanged, no tool mutations.
- [x] 3.7 Skip semantics (prompt-text assertions): unavailable model, failed invocation (`stopReason`/`errorMessage`), codemode absent → prompt instructs a visible skip report, no fallback, no abort, retry on the next eligible check; advisory `{complete, gaps[]}` and gap-handling wording retained.
- [x] 3.8 Manifest test: keep `pi` and `files` deep-equal green — no new files may be added to the package manifest for this change.

## 4. README

- [x] 4.1 Update the reconciler paragraph: the check is default-off, opt-in via `theon.classifier`, uses exactly the configured model, and visibly skips on unavailability/failure (replacing the always-on/soft-disable description).
- [x] 4.2 Document `theon.classifier` in the existing style: host global + project settings precedence, `false` project override, enabling shape `{provider, model}`, invalid-config diagnostic, prompt-driven nature (no technical guarantee).
- [x] 4.3 Qualify "Theon setzt weder Modelle": Theon still sets no chat or subagent models; `theon.classifier` only names the advisory classifier model; check the test-scope sentence ("starten keine Modelle") still holds.

## 5. Spec workflow and validation

- [x] 5.1 Before implementing, run `openspec validate configure-reconciler-classifier --strict` and fix any artifact issues it reports.
- [x] 5.2 Implement the tasks in this order (extension → instructions → tests → README), checking off each box only after its verification passes.
- [x] 5.3 Run `npm test` and `npm pack --dry-run` after implementation; all tests must pass with no new runtime or test dependencies.
- [x] 5.4 After implementation, validate the spec deltas' readiness (`openspec validate configure-reconciler-classifier --strict`) and confirm the active and archived specs were untouched during proposal creation; synchronize or archive the change via OpenSpec only when separately requested by the user — at that point the `reconciler-check` delta merges into `openspec/specs/reconciler-check/spec.md` and the new `classifier-configuration` spec lands, showing opt-in gating, exact-model selection, and visible-skip semantics.
