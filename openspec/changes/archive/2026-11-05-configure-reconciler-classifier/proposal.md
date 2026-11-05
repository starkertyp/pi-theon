## Why

The reconciler classifier check shipped in `add-reconciler-classifier-mvp` is instructed unconditionally whenever Theon is on: the orchestrator prompt says "pick a model" from whatever `models.getAvailableOfType("classifier")` returns (nondeterministic), and the check silently disappears when the catalog is empty. There is no way to turn the check on deliberately, pin it to one specific classifier model, disable it per project, or see why it did not run. This change makes the check controllable: default OFF, explicit opt-in through normal Pi settings naming exactly one classifier model, host/project precedence, and visible behavior when configuration is invalid or the configured model cannot run.

## What Changes

- **Default OFF.** The classifier check is instructed only when explicitly enabled. Missing or `false` configuration disables it. Theon off implies no classifier instructions (unchanged injection rule).
- **New configuration surface `theon.classifier`** in normal Pi settings (host global `~/.pi/agent/settings.json`, project `.pi/settings.json`, project wins):
  - missing or `false` → disabled;
  - `{ "provider": "<provider>", "model": "<model-id>" }` with both nonempty strings → enabled with exactly that classifier model;
  - no `enabled` flag, no automatic model selection, no substitute model — explicit configuration cannot silently select another model;
  - `false` in project settings disables a globally configured object.
- **Extension reads settings and conditionally injects** classifier instructions naming the configured model. Remains prompt-driven: no runtime invocation, no detection of final-success claims, no enforcement; execution is still not technically guaranteed.
- **Invalid config:** visible diagnostic, classifier disabled only, normal Theon/reconciliation continue; no settings files are rewritten.
- **Configured model unavailable or invocation fails** (including codemode capability absent): visible skip, no fallback, no abort; persisted config is not mutated and not permanently disabled; the next eligible check may retry.
- **Unchanged:** trigger timing (before final success claim after a worker/reviewer run), input contract (`acceptance_criteria`, `worker_report`, `diff_validation_summary`), question/evidence checking, advisory `{complete, gaps[]}` output, explicit gap handling, and mandatory normal parent reconciliation of real diff/test evidence in every case (disabled, succeeded, or failed).
- **Not included:** no new slash command, telemetry, benchmarking, dependency, config file, or metrics infrastructure. This delivers controllability, not proof of classifier usefulness.

## Capabilities

### New Capabilities

- `classifier-configuration`: The `theon.classifier` settings contract — opt-in default-off enablement, exact provider/model shape, host/project precedence, invalid-config diagnostics, and conditional prompt injection with Theon-off behavior.

### Modified Capabilities

- `reconciler-check`: The reconciliation gate becomes conditional on classifier configuration; model selection changes from "pick any available" to exactly the configured model via `models.getModelOfType("classifier", provider, model)`; the silent soft-disable requirement is replaced by explicit-config enablement with a visible skip on unavailability or invocation failure and retry on the next eligible check.

## Impact

- `extensions/theon.js` — first settings read (`pi.getSettings()`), config parsing/validation with visible diagnostics, conditional classifier-instruction injection (implemented during this change's apply phase; no source changes during proposal creation).
- `instructions/orchestrator.md` — classifier section becomes conditional, names the configured provider/model, uses `getModelOfType` instead of `getAvailableOfType` + pick-any, specifies visible-skip reporting.
- `test/theon.test.js` — harness double needs `getSettings`; new default-off/enabled/invalid-config/precedence scenarios; existing prompt regex assertions updated.
- `README.md` — default-off description, `theon.classifier` documentation, qualify "Theon setzt weder Modelle" without changing subagent model ownership.
- `openspec/specs/reconciler-check/spec.md` — amended through this change's delta spec when the change is archived (a separate, user-authorized finalization; not edited directly).
