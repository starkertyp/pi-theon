## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Soft-disable without a classifier model

**Reason**: The check is now opt-in via explicit `theon.classifier` configuration (default OFF). There is no always-instructed check left to silently disable: availability is only consulted for the one explicitly configured model, and unavailability or invocation failure of that model produces a visible skip with retry, not a silent pass.

**Migration**: To use the check, set `theon.classifier` to `{ "provider": "<provider>", "model": "<model-id>" }`. Without configuration, sessions reconcile without a classifier check — the same observable outcome as the old silent path, but as an explicit default rather than a reaction to an empty catalog.

The removed requirement's original content:

> When no classifier model is available, the reconciler step SHALL be silently skipped and prior behavior SHALL be preserved exactly.
>
> #### Scenario: No classifier configured
>
> - **WHEN** `models.getAvailableOfType("classifier")` yields no available model
> - **THEN** the orchestrator MUST reconcile as before (without the classifier check), MUST NOT surface an error, and all other behavior MUST be unchanged.
