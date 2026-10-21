// One-shot: ship the documenter subagent with the pi-theon package.
// Lane order matters: exactly one writer per cwd at a time.
const workerTask = [
  "Repo: /home/elevader/projects/pi-theon (Pi package pi-theon, ESM, node --test).",
  "Goal: the existing user-level subagent profile 'documenter' becomes part of this package.",
  "Steps:",
  "1. Copy ~/.pi/agent/agents/documenter.md verbatim to /home/elevader/projects/pi-theon/agents/documenter.md (create the agents/ dir). Keep the YAML frontmatter unchanged (name: documenter, tools: read, grep, find, edit, write, advertise: true, acceptanceRole: writer, inheritProjectContext: true) and the body unchanged.",
  "2. Delete only that file ~/.pi/agent/agents/documenter.md (leave the directory itself in place). Do not touch any other file under ~/.pi.",
  "3. package.json: add agents/documenter.md to 'files' so it becomes [\"agents/documenter.md\", \"extensions/theon.js\", \"instructions/orchestrator.md\", \"README.md\"], and expose the agent directory through the pi manifest: \"pi\": { \"extensions\": [\"./extensions/theon.js\"], \"subagents\": { \"agents\": [\"./agents\"] } } (pi-subagents reads pi.subagents.agents). Keep the rest of package.json untouched.",
  "4. test/theon.test.js: update the manifest assertions to the new exact shape (the deepEqual on manifest.pi and the manifest.files list). Do not weaken them; keep the existing loop that checks every listed file exists.",
  "Do NOT edit README.md (the documenter lane owns it afterwards) and do not edit instructions/orchestrator.md.",
  "Validation: run 'npm test' in the repo and report the real result.",
  "Do not delegate recursively, do not commit, do not publish.",
  "Report: changed files, the exact npm test result, and anything unexpected.",
].join("\n");

const readmeTask = [
  "Repo: /home/elevader/projects/pi-theon. Read README.md (German) and instructions/orchestrator.md and package.json first.",
  "Context: the package now ships its own subagent profile agents/documenter.md and exposes it via the pi manifest key pi.subagents.agents; the previously separate user-level copy ~/.pi/agent/agents/documenter.md has been removed. instructions/orchestrator.md already routes documentation work to 'documenter'.",
  "Task: make README.md consistent with that, smallest coherent change, same German voice, no marketing:",
  "- In the 'Bedienung' section, add documenter to the used roles: it is the documentation-only writer (docs content, indexes, navigation; never source, tests or config).",
  "- In the 'Installation und Start' section the sentence 'Es werden keine Agentenprofile kopiert.' is now wrong. Replace it with an accurate statement: the package ships the documenter profile itself (agents/documenter.md, declared through the manifest as a package agent) and copies nothing into ~/.pi/agent/agents; a user-level or project-level agent with the same name takes precedence over the package version.",
  "Do not change other files, do not reformat, do not run tests.",
  "Do not delegate recursively, do not commit.",
  "Report: the exact edits you made.",
].join("\n");

const verifyTask = [
  "Repo: /home/elevader/projects/pi-theon. Two prior lanes changed files: package.json, test/theon.test.js, new agents/documenter.md, README.md; ~/.pi/agent/agents/documenter.md was removed.",
  "Task: final read-only-plus-test verification, no new edits unless a real defect requires a minimal fix.",
  "1. Inspect 'git status --short' and 'git diff' and confirm: agents/documenter.md exists with intact frontmatter; package.json files[] and pi.subagents.agents are correct JSON; test/theon.test.js asserts the new manifest; README no longer claims that no agent profiles are copied; nothing else changed.",
  "2. Run 'npm test' and report the actual result. Also run 'npm pack --dry-run' and confirm agents/documenter.md is included.",
  "3. Report any discrepancy or leftover, including whether ~/.pi/agent/agents/documenter.md is really gone (ls ~/.pi/agent/agents).",
  "Do not delegate recursively, do not commit, do not publish.",
].join("\n");

const impl = await runs.run("worker-impl", { agent: "worker", task: workerTask });
const readme = await runs.run("documenter-readme", { agent: "documenter", task: readmeTask });
const verify = await runs.run("worker-verify", { agent: "worker", task: verifyTask });
return {
  impl: { ok: impl.ok, output: impl.output },
  readme: { ok: readme.ok, output: readme.output },
  verify: { ok: verify.ok, output: verify.output },
};
