import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { TAB_KEYS } from "../../app/layout/TabId";
import "../page.css";
import "./HelpPage.css";

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
const PALETTE_KEY = IS_MAC ? "⌘K" : "Ctrl+K";

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: TAB_KEYS.launcher, action: "Go to Launch" },
  { keys: TAB_KEYS.tools, action: "Go to Tools" },
  { keys: TAB_KEYS.history, action: "Go to History" },
  { keys: TAB_KEYS.costs, action: "Go to Costs" },
  { keys: TAB_KEYS.admin, action: "Go to Admin" },
  { keys: TAB_KEYS.help, action: "Show help" },
  { keys: PALETTE_KEY, action: "Open command palette" },
  { keys: "Esc", action: "Close dialog" },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "A CLI still shows as missing right after installing it",
    a: "Click the refresh control or switch tabs — detection re-runs on page load. A fresh shell environment may be needed if the installer didn't update PATH for running apps.",
  },
  {
    q: "Launch fails with a path error",
    a: "Make sure the working directory still exists and that you have permission to write there. Windows paths with special characters may need to be picked via the Browse button.",
  },
  {
    q: "Costs page shows no usage data",
    a: "Usage is read from each CLI's local log files. Run a supported CLI (Claude Code, Codex, Gemini) at least once so those files are created.",
  },
  {
    q: "Theme or accent color didn't apply",
    a: "Open the Admin tab and re-pick your theme and accent. If the issue persists, check the browser console (F12) for errors and restart the app.",
  },
];

const LINKS: Array<{ label: string; url: string }> = [
  { label: "README", url: "https://github.com/HelbertMoura/ai_launcher#readme" },
  { label: "Issues", url: "https://github.com/HelbertMoura/ai_launcher/issues" },
  {
    label: "Changelog",
    url: "https://github.com/HelbertMoura/ai_launcher/blob/main/CHANGELOG.md",
  },
];

export function HelpPage() {
  const openLink = async (url: string) => {
    try {
      await invoke<string>("open_external_url", { url });
    } catch {
      /* user-visible noop; the backend surfaces errors via tray if any */
    }
  };

  return (
    <section className="cd-page cd-help">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ HELP</h2>
          <p className="cd-page__sub">how to use AI Launcher Pro</p>
        </div>
      </header>

      <div className="cd-help__stack">
        <Card className="cd-help__section">
          <h3 className="cd-help__heading">// getting started</h3>
          <p className="cd-help__body">
            AI Launcher Pro detects and manages AI coding CLIs (Claude, Codex,
            Gemini, and more) and IDE tools installed on your machine. Pick a
            CLI, choose a working directory, and launch it in a fresh terminal
            session — launcher tracks history and usage locally without sending
            anything over the network.
          </p>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">// keyboard shortcuts</h3>
          <table className="cd-help__table">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={`${s.keys}-${s.action}`}>
                  <td className="cd-help__kbd">
                    <kbd>{s.keys}</kbd>
                  </td>
                  <td className="cd-help__action">{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">// troubleshooting</h3>
          <ul className="cd-help__faqs">
            {FAQS.map((f) => (
              <li key={f.q} className="cd-help__faq">
                <div className="cd-help__faq-q">{f.q}</div>
                <div className="cd-help__faq-a">{f.a}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">// links</h3>
          <div className="cd-help__links">
            {LINKS.map((l) => (
              <Button
                key={l.url}
                variant="ghost"
                size="sm"
                onClick={() => void openLink(l.url)}
              >
                {l.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
