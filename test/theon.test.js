import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import theon from "../extensions/theon.js";

function runtime(marker, tools = ["read", "bash", "edit", "write", "subagent"], settings = {}) {
  const handlers = new Map();
  const commands = new Map();
  const notices = [];
  const active = [...tools];
  const ctx = { ui: { notify: (text, level) => notices.push({ text, level }) } };
  const previous = process.env.PI_SUBAGENT_CHILD;
  try {
    if (marker === undefined) delete process.env.PI_SUBAGENT_CHILD;
    else process.env.PI_SUBAGENT_CHILD = marker;
    theon({
      on: (name, handler) => handlers.set(name, handler),
      registerCommand: (name, command) => commands.set(name, command),
      getActiveTools: () => [...active],
      setActiveTools: () => assert.fail("Theon must not change tools inherited by children"),
      getSettings: () => settings,
    });
  } finally {
    if (previous === undefined) delete process.env.PI_SUBAGENT_CHILD;
    else process.env.PI_SUBAGENT_CHILD = previous;
  }
  return {
    handlers, commands, notices, active,
    emit: (name, event = {}) => handlers.get(name)?.(event, ctx),
    command: (args) => commands.get("theon").handler(args, ctx),
  };
}

function promptEvent() {
  return {
    systemPrompt: "Host and other extensions",
    systemPromptOptions: {
      sections: { other_extension: "Keep me" },
      promptGuidelines: ["Existing rule"],
    },
  };
}

test("parent defaults on, adds a prompt section and preserves other prompt/tools", () => {
  const parent = runtime();
  parent.emit("session_start");
  const event = promptEvent();
  assert.equal(parent.emit("before_agent_start", event), undefined);
  assert.equal(event.systemPrompt, "Host and other extensions");
  assert.equal(event.systemPromptOptions.sections.other_extension, "Keep me");
  assert.deepEqual(event.systemPromptOptions.promptGuidelines, ["Existing rule"]);
  const prompt = event.systemPromptOptions.sections.pi_theon;
  assert.match(prompt, /user opts into delegation/);
  assert.match(prompt, /Delegate ALL implementation/);
  assert.match(prompt, /no polling, sleep loops, or bg_wait/);
  assert.match(prompt, /ONE writer per cwd\/worktree/);
  assert.match(prompt, /Delegation: use the active subagent tool/);
  assert.equal(parent.emit("tool_call", { toolName: "write" }).block, true);
  assert.equal(parent.emit("tool_call", { toolName: "edit" }).block, true);
  for (const toolName of ["read", "bash", "subagent", "other_extension_tool"]) {
    assert.equal(parent.emit("tool_call", { toolName }), undefined);
  }
  assert.deepEqual(parent.active, ["read", "bash", "edit", "write", "subagent"]);
});

test("async child marker makes the entire extension inert, even with write tools", () => {
  const child = runtime("1");
  assert.equal(child.handlers.size, 0);
  assert.equal(child.commands.size, 0);
  assert.equal(child.emit("tool_call", { toolName: "write" }), undefined);
  assert.deepEqual(child.active, ["read", "bash", "edit", "write", "subagent"]);
  for (const marker of [undefined, "0", "true", ""]) {
    assert.ok(runtime(marker).commands.has("theon"), `exact marker only: ${marker}`);
  }
});

test("on/off/status is local, reversible, validated and reset on session start", async () => {
  const parent = runtime();
  const otherParent = runtime();
  await parent.command("off");
  assert.equal(parent.emit("tool_call", { toolName: "write" }), undefined);
  assert.equal(parent.emit("before_agent_start", promptEvent()), undefined);
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  assert.equal(event.systemPromptOptions.sections.pi_theon, undefined);
  assert.equal(otherParent.emit("tool_call", { toolName: "write" }).block, true);
  for (const args of ["", "status", "invalid", "on extra"]) await parent.command(args);
  assert.match(parent.notices.at(-1).text, /Verwendung/);
  assert.equal(parent.emit("tool_call", { toolName: "edit" }), undefined);
  await parent.command(" on ");
  assert.equal(parent.emit("tool_call", { toolName: "edit" }).block, true);
  await parent.command("off");
  parent.emit("session_start");
  assert.equal(parent.emit("tool_call", { toolName: "edit" }).block, true);
  assert.deepEqual(parent.active, otherParent.active);
});

test("missing/disabled dependency is actionable in UI and model prompt, not a fallback", async () => {
  const parent = runtime(undefined, ["read", "bash", "edit", "write"]);
  parent.emit("session_start");
  assert.equal(parent.notices.at(-1).level, "warning");
  assert.match(parent.notices.at(-1).text, /pi install npm:pi-subagents/);
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  assert.match(event.systemPromptOptions.sections.pi_theon, /Delegation is unavailable/);
  assert.match(event.systemPromptOptions.sections.pi_theon, /Do not claim delegation or implement directly/);
  assert.equal(parent.emit("tool_call", { toolName: "write" }).block, true);
  await parent.command("status");
  assert.match(parent.notices.at(-1).text, /subagents-doctor/);
  await parent.command("off");
  assert.equal(parent.notices.at(-1).text, "Theon: off");
  assert.equal(parent.emit("tool_call", { toolName: "write" }), undefined);
  parent.active.push("subagents_enable");
  await parent.command("on");
  assert.equal(parent.notices.at(-1).text, "Theon: on");
});

test("lazy pi-subagents loader is recognized without activating or removing tools", () => {
  const parent = runtime(undefined, ["read", "subagents_enable"]);
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  assert.match(event.systemPromptOptions.sections.pi_theon, /call it first/);
  assert.doesNotMatch(event.systemPromptOptions.sections.pi_theon, /Delegation is unavailable/);
  assert.deepEqual(parent.active, ["read", "subagents_enable"]);
});

test("opaque system prompt override is preserved when appending policy", () => {
  const parent = runtime();
  const event = promptEvent();
  event.systemPromptOptions.forceSystemPrompt = event.systemPrompt;
  const result = parent.emit("before_agent_start", event);
  assert.ok(result.systemPrompt.startsWith("Host and other extensions\n\n<pi_theon>"));
  assert.match(result.systemPrompt, /parent orchestration mode/);
  assert.deepEqual(event.systemPromptOptions.sections, { other_extension: "Keep me" });
});

test("default off: no theon.classifier key injects no classifier instructions", () => {
  const parent = runtime();
  parent.emit("session_start");
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  const prompt = event.systemPromptOptions.sections.pi_theon;
  assert.match(prompt, /parent orchestration mode/);
  assert.match(prompt, /ONE writer per cwd\/worktree/);
  assert.match(prompt, /Before claiming success, reconcile child results with actual artifacts/);
  assert.doesNotMatch(prompt, /Reconciler classifier check/);
  assert.doesNotMatch(prompt, /getModelOfType|getAvailableOfType/);
  assert.equal(parent.notices.filter((n) => n.text.includes("theon.classifier")).length, 0);
  assert.equal(parent.emit("tool_call", { toolName: "edit" }).block, true);
  assert.equal(parent.emit("tool_call", { toolName: "write" }).block, true);
  assert.deepEqual(parent.active, ["read", "bash", "edit", "write", "subagent"]);
});

test("enabled classifier injects the block naming exactly the configured provider and model", () => {
  const parent = runtime(undefined, undefined, {
    theon: { classifier: { provider: "openrouter", model: "vendor/classifier-a" } },
  });
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  const prompt = event.systemPromptOptions.sections.pi_theon;
  assert.match(prompt, /Reconciler classifier check/);
  assert.match(prompt, /models\.getModelOfType\("classifier", "openrouter", "vendor\/classifier-a"\)/);
  assert.ok(prompt.includes("openrouter") && prompt.includes("vendor/classifier-a"));
  assert.doesNotMatch(prompt, /getAvailableOfType/);
  assert.doesNotMatch(prompt, /pick a model/);
  assert.doesNotMatch(prompt, /\{\{provider\}\}|\{\{model\}\}/);
  assert.equal(parent.notices.filter((n) => n.text.includes("theon.classifier")).length, 0);
});

test("merged settings boundary: false disables, project object supplies the model", () => {
  const disabled = runtime(undefined, undefined, { theon: { classifier: false } });
  const off = promptEvent();
  disabled.emit("before_agent_start", off);
  assert.doesNotMatch(off.systemPromptOptions.sections.pi_theon, /Reconciler classifier check|getModelOfType/);
  assert.equal(disabled.notices.length, 0);

  const project = runtime(undefined, undefined, {
    theon: { classifier: { provider: "project-provider", model: "project-model-1" } },
  });
  const on = promptEvent();
  project.emit("before_agent_start", on);
  assert.match(on.systemPromptOptions.sections.pi_theon, /project-provider/);
  assert.match(on.systemPromptOptions.sections.pi_theon, /project-model-1/);
});

test("/theon off suppresses prompt injection even with the classifier configured", async () => {
  const parent = runtime(undefined, undefined, {
    theon: { classifier: { provider: "openrouter", model: "vendor/classifier-a" } },
  });
  await parent.command("off");
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  assert.equal(event.systemPromptOptions.sections.pi_theon, undefined);
});

test("invalid theon.classifier values warn once, disable only the classifier", () => {
  const invalidValues = [
    true, 42, [], {},
    { provider: "", model: "m" },
    { provider: "p", model: "" },
    { provider: "p" },
    { model: "m" },
    { provider: 42, model: "m" },
    { provider: "p", model: null },
  ];
  for (const value of invalidValues) {
    const label = JSON.stringify(value);
    const parent = runtime(undefined, undefined, { theon: { classifier: value } });
    parent.emit("session_start");
    const event = promptEvent();
    parent.emit("before_agent_start", event);
    const prompt = event.systemPromptOptions.sections.pi_theon;
    const warnings = parent.notices.filter((n) => n.level === "warning" && n.text.includes("theon.classifier"));
    assert.equal(warnings.length, 1, label);
    assert.ok(warnings[0].text.includes(label), warnings[0].text);
    assert.match(warnings[0].text, /Erwartet: false oder \{"provider": "<provider>", "model": "<model-id>"\}/);
    assert.doesNotMatch(prompt, /Reconciler classifier check|getModelOfType|getAvailableOfType/);
    assert.match(prompt, /parent orchestration mode/);
    assert.match(prompt, /Before claiming success, reconcile child results with actual artifacts/);
    assert.equal(parent.emit("tool_call", { toolName: "edit" }).block, true);
    assert.equal(parent.emit("tool_call", { toolName: "write" }).block, true);
    for (const toolName of ["read", "bash", "subagent"]) {
      assert.equal(parent.emit("tool_call", { toolName }), undefined, label);
    }
    assert.deepEqual(parent.active, ["read", "bash", "edit", "write", "subagent"], label);
  }
});

test("classifier prompt keeps skip semantics and advisory gap handling", () => {
  const parent = runtime(undefined, undefined, {
    theon: { classifier: { provider: "openrouter", model: "vendor/classifier-a" } },
  });
  const event = promptEvent();
  parent.emit("before_agent_start", event);
  const prompt = event.systemPromptOptions.sections.pi_theon;
  assert.match(prompt, /stopReason/);
  assert.match(prompt, /errorMessage/);
  assert.match(prompt, /report the skipped check visibly in your final response/);
  assert.match(prompt, /do not pick another one/);
  assert.match(prompt, /no auto-selected, alternative, or substitute model/);
  assert.match(prompt, /continue normal reconciliation, change no configuration/);
  assert.match(prompt, /retry with the same configured model at the next eligible check/);
  assert.match(prompt, /never a hard failure/);
  assert.match(prompt, /\{complete: boolean, gaps\[\]\}/);
  assert.match(prompt, /gap must be explicitly resolved/);
  assert.match(prompt, /route corrections back through worker/);
  assert.match(prompt, /overridden with the justification recorded in the final response/);
  assert.match(prompt, /advisory and non-binding/);
  assert.match(prompt, /Before claiming success, reconcile child results with actual artifacts/);
});

test("manifest exposes the extension and subagent agents, keeping parent policy out of child resource discovery", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.deepEqual(manifest.pi, {
    extensions: ["./extensions/theon.js"],
    subagents: { agents: ["./agents"] },
  });
  assert.deepEqual(manifest.files, [
    "agents/documenter.md",
    "extensions/theon.js",
    "instructions/orchestrator.md",
    "README.md",
  ]);
  for (const file of manifest.files) assert.ok(readFileSync(new URL(`../${file}`, import.meta.url)).length);
  assert.equal(manifest.dependencies, undefined);
});
