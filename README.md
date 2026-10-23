# pi-theon

Ein kleines installierbares [Pi-Paket](https://pi.dev): Der Hauptagent plant,
liest zur Orientierung und Prüfung, delegiert Umsetzung **und Tests** und
führt die Ergebnisse zusammen. Inspiriert von
[oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim),
aber ohne eigenen Scheduler, Modell-Presets oder doppelte Agentenrollen.

## Installation und Start

Voraussetzung: Pi mit `before_agent_start.systemPromptOptions` (geprüfte
API-Basis: Pi **1.1.0**) und separat installiertes, aktiviertes
[pi-subagents](https://github.com/nicobailon/pi-subagents) (Vertrag geprüft
gegen **0.79.1**). pi-theon installiert pi-subagents nicht automatisch.

```sh
# Nur falls noch nicht installiert:
pi install npm:pi-subagents

# Lokaler Checkout; kein npm-Release erforderlich:
pi install /home/elevader/projects/pi-theon
pi
```

`pi install` ohne `--local` registriert das Paket in deinen persönlichen
Pi-Einstellungen. Für eine Projektinstallation stattdessen im Zielprojekt
`pi install --local /home/elevader/projects/pi-theon` ausführen und dem
Projekt beim Start vertrauen. Das Paket liefert das Profil `documenter` selbst
mit (`agents/documenter.md`, im Manifest als Paket-Agent unter
`pi.subagents.agents` deklariert) und kopiert nichts nach
`~/.pi/agent/agents`; ein Agent gleichen Namens auf Benutzer- oder
Projektebene hat Vorrang vor der Paketversion.

Bei bereits laufendem Pi `/reload` verwenden (oder Pi neu starten).
Ohne Installation für einen Start ausprobieren:

```sh
pi -e /home/elevader/projects/pi-theon
```

## Bedienung

```text
/theon status
/theon off
/theon on
```

Ohne Argument zeigt `/theon` ebenfalls den Status. Standard ist **on** im
Hauptagenten. Der Schalter gilt nur im aktuellen Extension-Runtime; neue
Sessions, Sessionwechsel und `/reload` starten wieder mit **on**. `off`
entfernt die Theon-Regeln beim nächsten Agentenstart und hebt die eigene
`edit`/`write`-Sperre sofort auf. Andere Tool-Sperren bleiben unberührt;
laufende Subagents werden nicht abgebrochen.

Mit **on** erlaubst du Delegation im Rahmen deines Auftrags, auch ohne bei
jedem Schritt ausdrücklich „Subagent“ zu sagen. Das ist keine Erlaubnis für
zusätzlichen Scope oder destruktive Aktionen. Beispiel:

> Untersuche den Fehler im Parser und lass worker die kleinste Korrektur
> samt Tests umsetzen. Prüfe das Ergebnis, bevor du Erfolg meldest.

Verwendet werden die vorhandenen Rollen `scout`, `worker`, `reviewer`,
`researcher` und `oracle`, dazu das mitgelieferte Profil `documenter`, das nur
Dokumentation schreibt (Doku-Inhalt, Indexe, Navigation; nie Quellcode, Tests
oder Konfiguration). Nicht jeder Auftrag braucht alle Rollen oder ein
Review. Ein Writer pro cwd/Worktree; native asynchrone Fertigmeldungen wecken
den Hauptagenten ohne Polling. Vor abschließenden Erfolgsmeldungen nach einem
Worker-/Reviewer-Lauf führt der Hauptagent eine beratende Reconciler-Prüfung
durch (Klassifikator-Modell via Codemode); steht kein Klassifikator zur
Verfügung, entfällt dieser Schritt stillschweigend. Der vollständige kurze Vertrag steht in
[`instructions/orchestrator.md`](instructions/orchestrator.md).

### Modelle und Abhängigkeiten

Dein vorhandenes Pi-Modell (`/model`, Provider-Anmeldung, Thinking) und die
pi-subagents-Konfiguration bleiben maßgeblich. Bei Bedarf Modelle dort über
`subagents.defaultModel` bzw. `subagents.agentOverrides.<rolle>.model`
konfigurieren, nicht in Theon. Theon setzt weder Modelle noch Tool-Listen
oder Capability Ceilings. Web-Recherche benötigt die von pi-subagents
vorgesehenen Web-Tools im Kind (z. B. pi-web-access).

Theon erkennt ein aktives `subagent` oder den Lazy-Loader `subagents_enable`.
Fehlen beide, warnen Start/Status und der Modell-Prompt mit konkreten
Schritten: pi-subagents installieren/aktivieren, neu starten oder `/reload`
und `/subagents-doctor` prüfen. Bis dahin sind Lesen und Planung möglich;
keine vorgetäuschte Delegation und kein stiller CLI-Fallback. Für bewusste
direkte Arbeit `/theon off` verwenden. Tool-Präsenz beweist noch keinen
erfolgreichen Launch; Laufzeitfehler müssen gemeldet werden.

## Grenzen und Kind-Sessions

- **Keine Sandbox:** Nur Aufrufe der exakt benannten Tools `edit` und `write`
  werden im Hauptagenten durch `tool_call` blockiert. Bash, Codemode,
  benutzerdefinierte Tools und Extensions können weiterhin schreiben.
  Read-only-Shell und Delegation sind dort **Prompt-Policy**, keine technische
  Sicherheitsgarantie. Das Paket läuft mit den Rechten von Pi.
- pi-subagents lädt in normalen lokalen Vordergrund-Kindern keine ambienten
  Parent-Extensions. Im Hintergrund-Runner ist `PI_SUBAGENT_CHILD=1` gesetzt;
  Theon registriert dort **gar nichts**. Kind-Writer behalten ihre eigenen
  Schreibtools. Die Parent-Toolauswahl wird von Theon nie verändert.
- **Nicht unterstützt:** Theon ausdrücklich über `extensions` oder
  `subagentOnlyExtensions` in Vordergrund-Kinder injizieren. Diese teilen den
  Parent-Prozess und haben keinen verlässlichen dokumentierten Kind-Marker.
  Theon ist ein Paket für den Hauptagenten, keine Child-Extension.
- Geforkte Kinder können Parent-Historie als Referenz erben; die Regeln sind
  ausdrücklich nur an den Parent adressiert. Neue Worker erhalten einen
  eigenständigen Brief und sollen nicht rekursiv delegieren. Die normale
  Rekursionsgrenze und Tool-Verfügbarkeit gehören pi-subagents.
- Andere Prompt-Abschnitte und aktive Tools bleiben erhalten. Ein vorheriger
  vollständiger Prompt-Override wird mit erhaltenem Text ergänzt. Später
  geladene Extensions können den Prompt erneut überschreiben; widersprüchliche
  Policies müssen im eigenen Setup abgestimmt werden.
- Kein eigener Scheduler, keine Persistenz des Schalters, keine automatischen
  Modellwechsel, Commits oder Veröffentlichungen.

## Prüfen

Keine neuen Runtime- oder Test-Abhängigkeiten; für Tests Node.js mit
integriertem Test-Runner verwenden (hier Node **24**).

```sh
npm test
npm pack --dry-run
```

Die Tests prüfen Extension-Hooks mit einem kleinen Pi-API-Testdouble:
Parent/Async-Kind-Trennung, exakten Kind-Marker, Schalter und reversible
Sperre ohne Tool-Änderung, fehlende/verspätete Dependency, Lazy-Loader,
Prompt-Komposition und Manifest. Sie starten keine Modelle und keine
verschachtelten Subagents. Für einen manuellen End-to-End-Check im eigenen
Setup: Status prüfen, einen kleinen Worker-Auftrag ausführen lassen,
Kind-Schreibtools/Fertigmeldung kontrollieren und anschließend `off` testen.
