# Spec: reconciler-check

## Purpose

The `reconciler-check` capability defines the advisory classifier check the orchestrator runs before making a final success claim about a completed worker or reviewer run. It is opt-in, active only when the classifier is enabled by valid `theon.classifier` configuration, uses exactly that configured model, and skips visibly rather than falling back to another model or aborting the phase. The normal evidence-based reconciliation of run reports remains mandatory in every case; this check never replaces it.

## Requirements

### Requirement: Reconciliation gate before success claims

The orchestrator SHALL run a classifier check before making any final success claim about a completed worker or reviewer run, but only when the classifier is enabled by valid `theon.classifier` configuration. When the classifier is disabled, no classifier check is run and the orchestrator reconciles without it.

#### Scenario: Worker run completes

- **WHEN** the classifier is enabled, a worker run completes, and the orchestrator intends to state that the work succeeded
- **THEN** the orchestrator MUST first run a codemode classifier check with the configured model, comparing the worker report against the brief's acceptance criteria and the actual evidence (diff, validation command results), before making the success claim.

#### Scenario: Reviewer run completes

- **WHEN** the classifier is enabled, a reviewer run completes, and the orchestrator intends to claim the reviewed change is accepted
- **THEN** the orchestrator MUST first run the classifier check with the configured model on the reviewer's findings against the same brief-derived criteria and actual evidence.

#### Scenario: Classifier disabled

- **WHEN** the classifier is disabled (no `theon.classifier` key, `false`, or invalid configuration) and a worker or reviewer run completes
- **THEN** the orchestrator MUST NOT run a classifier check and MUST reconcile using its normal evidence-based reconciliation.

### Requirement: Exact configured classifier model

When the classifier is enabled, the check SHALL resolve exactly the configured provider and model via `models.getModelOfType("classifier", provider, model)` and classify with that model. The orchestrator MUST NOT pick a different available model, auto-select, or substitute another model for the configured one.

#### Scenario: Configured model resolves

- **WHEN** the classifier is enabled and `models.getModelOfType("classifier", provider, model)` resolves the configured model
- **THEN** the classifier check runs with exactly that model.

#### Scenario: No substitution

- **WHEN** the configured model is not resolvable or not available
- **THEN** no other model is used for the check; the skip is handled per "Visible skip on unavailability or invocation failure".

### Requirement: Visible skip on unavailability or invocation failure

When the configured classifier model is unavailable, or the classify invocation fails (including when the codemode capability is absent from the session), the orchestrator SHALL visibly report the skipped check, MUST NOT fall back to another model, MUST NOT abort the phase, MUST NOT mutate persisted configuration, and MUST NOT permanently disable the classifier. The next eligible check MAY retry with the same configured model.

#### Scenario: Configured model unavailable

- **WHEN** the configured model is not available in the session
- **THEN** the orchestrator reports the skip visibly, continues with its normal reconciliation, and changes no configuration.

#### Scenario: Invocation fails

- **WHEN** the `classify` call returns a provider error (checked via `stopReason` / `errorMessage`; `classify()` does not throw), or the codemode capability is absent
- **THEN** the orchestrator reports the skipped check visibly and treats it as "no finding", never as a hard failure of the phase.

#### Scenario: Retry on the next eligible check

- **WHEN** a check was skipped and the next trigger occurs (before a final success claim after a subsequent worker/reviewer run)
- **THEN** the orchestrator MAY run the check again with the same configured model; the earlier skip did not permanently disable it.

### Requirement: Classifier input contract

The classifier check SHALL be fed a JSON input built from the existing brief contract, with no new structures.

#### Scenario: Assembling the check

- **WHEN** the orchestrator runs the classifier check
- **THEN** the input MUST contain:
  - `acceptance_criteria`: the brief's acceptance criteria, expected evidence and validation commands (verbatim from the brief);
  - `worker_report`: the worker or reviewer completion summary;
  - `diff_validation_summary`: the orchestrator's own reading of the real diff and actual validation results;
- **AND** the classifier question MUST be "Is every criterion backed by evidence from the diff/validation?"
- **AND** the expected output shape MUST be `{ "complete": boolean, "gaps": string[] }` where each gap names the unmet criterion and the missing evidence.

### Requirement: Advisory treatment of findings

Classifier findings SHALL be advisory: non-binding inputs the orchestrator must explicitly resolve, never an automatic gate.

#### Scenario: Gaps reported

- **WHEN** the classifier returns `complete: false` with one or more gaps
- **THEN** for each gap the orchestrator MUST either route corrections back through worker, record a justified override, or accept the result with an explicit explanation — and only then may the success claim be made.

#### Scenario: Check passes

- **WHEN** the classifier returns `complete: true`
- **THEN** the orchestrator may proceed to the success claim as it would after its own reconciliation.

#### Scenario: Classifier call fails

- **WHEN** the classify call returns a provider error (check `stopReason` / `errorMessage`; `classify()` does not throw)
- **THEN** the orchestrator MUST treat it as "no finding" and continue with its normal reconciliation, never as a hard failure of the phase.