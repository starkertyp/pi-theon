# Spec: classifier-configuration

## Purpose

The `classifier-configuration` capability defines the `theon.classifier` settings contract: the reconciler classifier check is opt-in and disabled by default, and explicit configuration names exactly one classifier model with host/project precedence. It introduces no behavior beyond reading and validating that configuration and conditionally injecting the classifier instructions into the agent prompt.

## Requirements

### Requirement: Opt-in classifier with explicit configuration

The classifier SHALL be disabled by default. It SHALL be enabled only by an explicit `theon.classifier` value in Pi settings that names exactly one classifier model.

#### Scenario: Default off

- **WHEN** Pi settings contain no `theon.classifier` key
- **THEN** the classifier is disabled and no classifier instructions are injected into the agent prompt.

#### Scenario: Explicit enablement

- **WHEN** `theon.classifier` is an object `{ "provider": "<provider>", "model": "<model-id>" }` where both `provider` and `model` are nonempty strings
- **THEN** the classifier is enabled for exactly that provider and model.

#### Scenario: Explicit disable

- **WHEN** `theon.classifier` is `false`
- **THEN** the classifier is disabled and no diagnostic is surfaced for the disable.

### Requirement: Strict configuration shape

The enabling object SHALL provide `provider` and `model`, each a required nonempty string; these two fields are the only supported configuration fields. There SHALL be no `enabled` flag, no automatic model selection, and no substitute model; explicit configuration MUST NOT silently select another model. Validation targets the two documented fields and does not reject the object for containing other properties (no closed-object validation).

#### Scenario: No substitute model

- **WHEN** the classifier is enabled with a configured provider and model
- **THEN** that exact model is the only model the configuration can enable, and no other available model may be used in its place.

### Requirement: Host settings precedence

`theon.classifier` SHALL be read from normal Pi settings — host global `~/.pi/agent/settings.json` and project `.pi/settings.json` — with project settings taking precedence over host global settings.

#### Scenario: Project object overrides global object

- **WHEN** the host global settings configure one `theon.classifier` object and the project settings configure a different `theon.classifier` object
- **THEN** the project object is the effective configuration.

#### Scenario: Project false disables global object

- **WHEN** the host global settings configure an enabling `theon.classifier` object and the project settings set `theon.classifier` to `false`
- **THEN** the classifier is disabled.

### Requirement: Invalid configuration handling

An invalid `theon.classifier` value (any value that is neither `false` nor an object with nonempty string `provider` and `model`, including `true`) SHALL produce a visible diagnostic and disable the classifier only. Normal Theon orchestration and reconciliation SHALL continue unchanged, and settings files MUST NOT be rewritten.

#### Scenario: Malformed value

- **WHEN** `theon.classifier` is `true`, a number, an array, or an object with a missing, empty, or non-string `provider` or `model`
- **THEN** a visible diagnostic identifies the invalid configuration and the classifier is disabled.

#### Scenario: Scoped impact

- **WHEN** an invalid `theon.classifier` value is detected
- **THEN** only the classifier is disabled; Theon's orchestration, delegation, and reconciliation behavior continue normally.

#### Scenario: No settings mutation

- **WHEN** an invalid `theon.classifier` value is detected
- **THEN** Theon does not modify any settings file to "fix" or persist the disable.

### Requirement: Conditional prompt injection

The extension SHALL read the merged settings when composing the prompt for an agent start and SHALL inject classifier instructions only when the classifier is enabled. The classifier remains prompt-driven: the extension MUST NOT invoke models, detect final-success claims, or enforce execution. Theon off SHALL imply no classifier instructions. Child sessions remain inert per the existing child-marker rule.

#### Scenario: Enabled and Theon on

- **WHEN** the classifier is enabled and Theon is on
- **THEN** the injected prompt contains the classifier instructions naming the configured provider and model.

#### Scenario: Theon off

- **WHEN** Theon is off
- **THEN** no classifier instructions are injected (no Theon instructions at all are injected).

#### Scenario: Settings read at prompt composition

- **WHEN** settings are composed for an agent start
- **THEN** the host's current merged `theon.classifier` value decides injection; when settings changes on disk become visible (reload, restart, or any host-side refresh) is governed by Pi, and Theon adds no caching or hot-reload machinery of its own.