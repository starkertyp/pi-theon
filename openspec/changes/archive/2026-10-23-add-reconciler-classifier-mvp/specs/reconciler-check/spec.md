# Spec Delta: reconciler-check

## ADDED Requirements

### Requirement: Reconciliation gate before success claims

The orchestrator SHALL run a classifier check before making any final success claim about a completed worker or reviewer run.

#### Scenario: Worker run completes

- **WHEN** a worker run completes and the orchestrator intends to state that the work succeeded
- **THEN** the orchestrator MUST first run a codemode classifier check comparing the worker report against the brief's acceptance criteria and the actual evidence (diff, validation command results) before making the success claim.

#### Scenario: Reviewer run completes

- **WHEN** a reviewer run completes and the orchestrator intends to claim the reviewed change is accepted
- **THEN** the orchestrator MUST first run the classifier check on the reviewer's findings against the same brief-derived criteria and actual evidence.

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

### Requirement: Soft-disable without a classifier model

When no classifier model is available, the reconciler step SHALL be silently skipped and prior behavior SHALL be preserved exactly.

#### Scenario: No classifier configured

- **WHEN** `models.getAvailableOfType("classifier")` yields no available model
- **THEN** the orchestrator MUST reconcile as before (without the classifier check), MUST NOT surface an error, and all other behavior MUST be unchanged.