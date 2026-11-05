## Context

Today the reconciler classifier check lives entirely in prompt text. `extensions/theon.js` (~50 lines) statically reads `instructions/orchestrator.md` at load and injects it verbatim as prompt section `pi_theon` when Theon is on (default on, reset per `session_start`; child sessions are inert via `PI_SUBAGENT_CHILD === "1"`). The classifier section (orchestrator.md lines 29–42) is unconditional: before any final success claim after a worker/reviewer run, the orchestrator is told to call `models.getAvailableOfType("classifier")`, "pick a model" (selection rule unspecified), then `models.classify`, treating a failed call as "no finding" and skipping silently if the catalog is empty. The extension has no settings logic, no classifier runtime code, and no way to detect success claims. The active spec `reconciler-check` mandates this always-instructed behavior; the archived MVP (D5) explicitly deferred any extension enforcement — this stays deferred.

Verified host facts (pi 1.5.0 docs): `pi.getSettings()` returns merged settings where project `.pi/settings.json` wins over host global `~/.pi/agent/settings.json`; the settings schema is permissive (`additionalProperties: true`), so a `theon.classifier` key needs no schema change. Codemode exposes `getModelOfType(type, provider, id): Promise<ModelInfo | undefined>` for an explicit model pick, and `classify(model, context)` uses only `{provider, id}` and reports provider errors via `stopReason`/`errorMessage` (it does not throw). The test double in `test/theon.test.js` currently stubs only `on`/`registerCommand`/`getActiveTools`/`setActiveTools` — a `pi.getSettings()` call would throw against it.

## Goals / Non-Goals

**Goals**

- Default OFF: no classifier instructions unless explicitly enabled.
- Explicit, exact model selection via `theon.classifier` `{provider, model}` — never auto-picked, never substituted.
- Host/project settings precedence with a `false` project override of a global object.
- Visible diagnostics for invalid config; visible skip with retry for unavailable/failing model — classifier disabled or skipped only, Theon and reconciliation always continue normally.
- Preserve the prompt-driven advisory design: input contract, `{complete, gaps[]}` output, explicit gap handling, mandatory reconciliation of real diff/test evidence in all cases.

**Non-Goals**

- No runtime classifier invocation, enforcement, or final-success-claim detection in the extension (archived MVP D5 deferral stands).
- No guarantee that the model actually runs the check — controllability of what is instructed, not proof of execution or usefulness.
- No new slash command, telemetry, benchmarking, dependency, config file, schema, or metrics infrastructure.
- No change to subagent or main-model ownership: Theon still sets no chat/subagent models.
- No change to the input contract, advisory treatment, or gap-handling semantics.

## Decisions

### D1: Configuration surface — `theon.classifier` in standard Pi settings

Read via `pi.getSettings()` when composing the prompt at each `before_agent_start`. Host merge semantics already give global-then-project precedence (project wins); a `false` project value therefore disables a globally configured object without any merge code of our own. The extension consumes whatever merged snapshot the host returns at that moment; when settings changes on disk become visible (reload, restart, or any host-side refresh) is governed by Pi, not by Theon — no caching, no hot-reload machinery, no watchers, and no independent next-turn disk-refresh guarantee is promised.

Alternatives rejected: a `/theon` subcommand (the existing switch is deliberately non-persistent per session and cannot express a durable model pin); a package-manifest key (no host precedent for config values); naming the model only in prompt text (no precedence, invisible to the user). No new config file and no schema registration — the host schema is permissive and other installed extensions (e.g. pi-subagents) already use settings keys without schema entries, validated with plain type checks that name the offending file.

### D2: Value shape — binary and strict

- `theon.classifier` missing or `false` → disabled, no diagnostic (a valid, deliberate state).
- Object with `provider` and `model`, each a nonempty string → enabled with exactly that provider/model pair.
- Anything else — including `true`, numbers, arrays, or an object with missing/empty/non-string fields → invalid: visible diagnostic, classifier disabled, everything else continues.
- There is no `enabled` flag, no automatic model selection, and no substitute model. Explicit configuration must not silently select another model, so validation checks exactly the two documented fields; other object properties are ignored (permissive host schema, and an `enabled` key would have no defined meaning to accidentally honor).
- `true` is invalid rather than silently ignored: a user setting `true` expects enablement, and silence would hide the mistake. The diagnostic tells them the required shape.

### D3: Prompt composition — conditional injection of a parameterized section

The classifier block in `instructions/orchestrator.md` becomes a separately delimited section that `theon.js` includes only when the classifier is enabled, with the configured provider/model inserted. The instructions switch from `getAvailableOfType` + "pick a model" to `models.getModelOfType("classifier", provider, model)` so the exact configured model — and only it — is resolved and passed to `classify`. Theon off already suppresses the whole injected prompt, which by construction removes the classifier instructions too; child sessions stay inert (existing `PI_SUBAGENT_CHILD` rule). The extension still performs no model calls and no success-claim detection; this remains prompt policy, documented as such in the README, not a technical guarantee.

### D4: Failure visibility — split by who can observe the failure

- **Invalid config** is observable by the extension, so it surfaces a visible diagnostic when the invalid value is detected, through the existing UI notification channel (`ctx.ui.notify`, same pattern as the missing-pi-subagents warning; no custom caching or dedup subsystem). It never rewrites settings files.
- **Unavailable model / failed invocation** (including codemode capability absent in the session) happens inside the orchestrator's codemode run, where the extension has no code. Visibility is therefore prompt-instructed: the instructions require the orchestrator to report the skip (with `stopReason`/`errorMessage` checked; `classify()` does not throw) in its final response. No fallback to another model, no abort of the phase, no mutation of persisted config, no permanent disable; the next eligible check may retry with the same configuration. As with all Theon policy, a lazy model could skip the report — accepted and documented rather than solved with enforcement machinery.

### D5: Unchanged advisory semantics

Trigger timing stays "before any final success claim after a worker/reviewer run". The input stays the plain-JSON contract (`acceptance_criteria`, `worker_report`, `diff_validation_summary`), the question stays "Is every criterion backed by evidence from the diff/validation?", the expected output stays `{complete, gaps[]}`, findings stay advisory and non-binding, and each gap must still be explicitly resolved (confirm and route back through worker, override with justification, or accept with explanation). Normal parent reconciliation of the real diff/test evidence remains mandatory whether the classifier is disabled, succeeds, or fails — the classifier adds evidence, never a gate.

## Risks / Trade-offs

- **Prompt-driven means execution is not guaranteed** → accepted, unchanged in kind from all other Theon policy; README states prompt policy is not a technical guarantee. The "visible skip" report likewise depends on the model's compliance.
- **Default OFF is a behavior change vs. the active spec** → the spec is amended through this change's delta (never edited directly); users who relied on the always-instructed check must configure `theon.classifier` explicitly — that is the approved design intent.
- **Controllability does not prove usefulness** → explicitly out of scope; no benchmarking or telemetry is added to measure it.
- **Test harness lacks `getSettings`** → tasks extend the existing double with a settings stub; the manifest deep-equal test is unaffected because no new files are added to `pi.files`.
- **README drift** → the default-on check description and "Theon setzt weder Modelle" must be qualified in the same change; the qualification covers only the advisory classifier model, not chat/subagent models.
- **Ignored extra keys could hide typos** (e.g. `{"provider": ..., "model": ..., "modell": ...}`) → accepted: validation targets the documented contract fields, matching the permissive host schema convention.

## Migration Plan

No migration for default users: without `theon.classifier`, sessions reconcile without a classifier check — the same observable outcome as today's empty-catalog path, now by explicit default. Users who want the check set `theon.classifier` to `{"provider": "<provider>", "model": "<model-id>"}` (optionally per project). Rollback is reverting the source/prompt/test/README changes; the settings key is simply ignored by the previous version.

## Open Questions

None — shape, precedence, failure semantics, and scope are settled by the approved design.
