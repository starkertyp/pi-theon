import { readFileSync } from "node:fs";

const missingDependency = "pi-subagents fehlt oder ist deaktiviert. pi install npm:pi-subagents ausführen, Pi neu starten oder /reload verwenden und /subagents-doctor prüfen. Alternativ: /theon off für direkte Arbeit.";

const classifierStart = "<!-- classifier:start -->";
const classifierEnd = "<!-- classifier:end -->";

// `theon.classifier`: missing/false → undefined (disabled), object with nonempty
// string provider/model → that pair, anything else → "invalid".
function parseClassifier(value) {
  if (value === undefined || value === false) return undefined;
  if (
    value !== null && typeof value === "object" && !Array.isArray(value) &&
    typeof value.provider === "string" && value.provider !== "" &&
    typeof value.model === "string" && value.model !== ""
  ) {
    return { provider: value.provider, model: value.model };
  }
  return "invalid";
}

/** @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi */
export default function theon(pi) {
  // Foreground children do not load ambient extensions; the async runner sets this marker.
  if (process.env.PI_SUBAGENT_CHILD === "1") return;

  const file = readFileSync(new URL("../instructions/orchestrator.md", import.meta.url), "utf8").trim();
  const start = file.indexOf(classifierStart);
  const end = file.indexOf(classifierEnd);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`instructions/orchestrator.md: missing ${classifierStart} or ${classifierEnd} marker`);
  }
  const head = file.slice(0, start).trim();
  const classifierTemplate = file.slice(start + classifierStart.length, end).trim();
  const tail = file.slice(end + classifierEnd.length).trim();
  let enabled = true;
  const canDelegate = () => pi.getActiveTools().some((name) => name === "subagent" || name === "subagents_enable");
  const status = () => `Theon: ${enabled ? "on" : "off"}${enabled && !canDelegate() ? ` — ${missingDependency}` : ""}`;

  pi.on("session_start", (_event, ctx) => {
    enabled = true;
    ctx.ui.notify(status(), canDelegate() ? "info" : "warning");
  });

  pi.registerCommand("theon", {
    description: "Orchestrierung: /theon on|off|status",
    handler: async (args, ctx) => {
      const mode = args.trim() || "status";
      if (!["on", "off", "status"].includes(mode)) {
        ctx.ui.notify("Verwendung: /theon on|off|status", "warning");
        return;
      }
      if (mode !== "status") enabled = mode === "on";
      ctx.ui.notify(status(), enabled && !canDelegate() ? "warning" : "info");
    },
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!enabled) return;
    const classifierValue = pi.getSettings()?.theon?.classifier;
    const classifier = parseClassifier(classifierValue);
    if (classifier === "invalid") {
      ctx.ui.notify(
        `theon.classifier ungültig: ${JSON.stringify(classifierValue)}. Erwartet: false oder {"provider": "<provider>", "model": "<model-id>"}. Der Klassifikator bleibt aus.`,
        "warning",
      );
    }
    const classifierSection = typeof classifier === "object"
      ? classifierTemplate.replaceAll("{{provider}}", classifier.provider).replaceAll("{{model}}", classifier.model)
      : "";
    const instructions = [head, classifierSection, tail].filter(Boolean).join("\n\n");
    const prompt = `${instructions}\n\n${canDelegate()
      ? "Delegation: use the active subagent tool; if only subagents_enable is active, call it first and delegate on the next request."
      : `Delegation is unavailable. Tell the user: ${missingDependency} Do not claim delegation or implement directly while Theon is on. You may still read and plan.`}`;
    // Keep opaque prompt overrides intact, too; never replace another extension's text.
    if (event.systemPromptOptions.forceSystemPrompt !== undefined) {
      return { systemPrompt: `${event.systemPrompt}\n\n<pi_theon>\n${prompt}\n</pi_theon>` };
    }
    event.systemPromptOptions.sections.pi_theon = prompt;
  });

  pi.on("tool_call", (event) => {
    if (enabled && (event.toolName === "edit" || event.toolName === "write")) {
      return { block: true, reason: "Theon: Änderungen an worker delegieren; /theon off erlaubt wieder direkte edit/write-Aufrufe." };
    }
  });
}
