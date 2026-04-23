import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Dialog } from "../../ui/Dialog";
import { TAB_KEYS } from "../../app/layout/TabId";
import { ONBOARDING_STORAGE_KEY } from "../../app/onboarding";
import { AnimatedTerminal } from "./AnimatedTerminal";
import "../page.css";
import "./HelpPage.css";

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
const PALETTE_KEY = IS_MAC ? "⌘K" : "Ctrl+K";

const LINKS: Array<{ label: string; url: string }> = [
  { label: "GitHub", url: "https://github.com/HelbertMoura/ai_launcher" },
  { label: "README", url: "https://github.com/HelbertMoura/ai_launcher#readme" },
  { label: "Issues", url: "https://github.com/HelbertMoura/ai_launcher/issues" },
  {
    label: "Changelog",
    url: "https://github.com/HelbertMoura/ai_launcher/blob/main/CHANGELOG.md",
  },
];

export function HelpPage() {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const shortcuts: Array<{ keys: string; actionKey: string }> = [
    { keys: TAB_KEYS.launcher, actionKey: "help.actionGoLaunch" },
    { keys: TAB_KEYS.tools, actionKey: "help.actionGoTools" },
    { keys: TAB_KEYS.history, actionKey: "help.actionGoHistory" },
    { keys: TAB_KEYS.costs, actionKey: "help.actionGoCosts" },
    { keys: TAB_KEYS.admin, actionKey: "help.actionGoAdmin" },
    { keys: TAB_KEYS.help, actionKey: "help.actionShowHelp" },
    { keys: PALETTE_KEY, actionKey: "help.actionOpenPalette" },
    { keys: "Esc", actionKey: "help.actionCloseDialog" },
  ];

  const faqs: Array<{ qKey: string; aKey: string }> = [
    { qKey: "help.faqInstalledMissingQ", aKey: "help.faqInstalledMissingA" },
    { qKey: "help.faqLaunchFailQ", aKey: "help.faqLaunchFailA" },
    { qKey: "help.faqCostsQ", aKey: "help.faqCostsA" },
    { qKey: "help.faqThemeQ", aKey: "help.faqThemeA" },
  ];

  const openLink = async (url: string) => {
    try {
      await invoke<string>("open_external_url", { url });
    } catch {
      /* noop */
    }
  };

  const resetOnboarding = () => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setConfirmOpen(false);
    window.location.reload();
  };

  return (
    <section className="cd-page cd-help">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h2 className="cd-page__title">▎ {t("help.title")}</h2>
          <p className="cd-page__sub">{t("help.subtitle")}</p>
        </div>
      </header>

      <div className="cd-help__stack">
        <AnimatedTerminal />

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">{t("help.gettingStarted")}</h3>
          <p className="cd-help__body">{t("help.gettingStartedBody")}</p>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">{t("help.shortcuts")}</h3>
          <table className="cd-help__table">
            <tbody>
              {shortcuts.map((s) => (
                <tr key={`${s.keys}-${s.actionKey}`}>
                  <td className="cd-help__kbd">
                    <kbd>{s.keys}</kbd>
                  </td>
                  <td className="cd-help__action">{t(s.actionKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">{t("help.troubleshooting")}</h3>
          <ul className="cd-help__faqs">
            {faqs.map((f) => (
              <li key={f.qKey} className="cd-help__faq">
                <div className="cd-help__faq-q">{t(f.qKey)}</div>
                <div className="cd-help__faq-a">{t(f.aKey)}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">{t("help.tour")}</h3>
          <p className="cd-help__body">{t("help.tourBody")}</p>
          <div className="cd-help__links">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              ⟳ {t("help.tourButton")}
            </Button>
          </div>
        </Card>

        <Card className="cd-help__section">
          <h3 className="cd-help__heading">{t("help.links")}</h3>
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

        <Card className="cd-help__section cd-help__about">
          <h3 className="cd-help__heading">// about</h3>
          <p className="cd-help__body">
            AI Launcher Pro — Desktop launcher for AI coding CLIs.
          </p>
          <p className="cd-help__body">
            Made with ♥ by <strong>Helbert Moura</strong> · <strong>DevManiac's</strong>
          </p>
          <p className="cd-help__version">v11.0.0 · MIT License</p>
        </Card>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("help.tourConfirmTitle")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={resetOnboarding}>
              {t("help.tourConfirmOk")}
            </Button>
          </>
        }
      >
        <p>{t("help.tourConfirmBody")}</p>
      </Dialog>
    </section>
  );
}
