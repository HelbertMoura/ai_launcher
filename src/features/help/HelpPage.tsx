import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Dialog } from "../../ui/Dialog";
import { Icon } from "../../ui/Icon";
import { Coffee } from "../../ui/icons";
import { TAB_KEYS } from "../../app/layout/TabId";
import { openExternalUrlCommand } from "../../lib/tauri";
import { removeKey } from "../../lib/storage";
import { AnimatedTerminal } from "./AnimatedTerminal";
import pkg from "../../../package.json";
import "../page.css";
import "./HelpPage.css";

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
const PALETTE_KEY = IS_MAC ? "⌘K" : "Ctrl+K";

const LINKS: Array<{ label: string; url: string }> = [
  { label: "Dev Maniac's", url: "https://devmaniacs.com.br/" },
  { label: "Redes & Contatos", url: "https://linktr.ee/helbertmoura" },
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
      await openExternalUrlCommand(url);
    } catch {
      /* noop */
    }
  };

  const resetOnboarding = () => {
    removeKey("onboardingDone");
    setConfirmOpen(false);
    window.location.reload();
  };

  return (
    <section className="cd-page cd-help">
      <header className="cd-page__head">
        <div className="cd-page__heading">
          <h1 className="cd-page__title">▎ {t("help.title")}</h1>
          <p className="cd-page__sub">{t("help.subtitle")}</p>
        </div>
      </header>

      <div className="cd-help__layout">
        <section className="cd-help__hero" aria-label={t("help.overviewLabel")}>
          <AnimatedTerminal />
          <div className="cd-help__intro">
            <h2 className="cd-help__heading">{t("help.gettingStarted")}</h2>
            <p className="cd-help__body">{t("help.gettingStartedBody")}</p>
            <div className="cd-help__chips">
              <span>{t("help.localOnly")}</span>
              <span>{t("help.secureStorage")}</span>
              <span>{t("help.commandDeck")}</span>
            </div>
          </div>
        </section>

        <Card className="cd-help__section cd-help__section--shortcuts">
          <h2 className="cd-help__heading">{t("help.shortcuts")}</h2>
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

        <Card className="cd-help__section cd-help__section--wide">
          <h2 className="cd-help__heading">{t("help.troubleshooting")}</h2>
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
          <h2 className="cd-help__heading">{t("help.tour")}</h2>
          <p className="cd-help__body">{t("help.tourBody")}</p>
          <div className="cd-help__links">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              ⟳ {t("help.tourButton")}
            </Button>
          </div>
        </Card>

        <Card className="cd-help__section">
          <h2 className="cd-help__heading">{t("help.links")}</h2>
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
          <h2 className="cd-help__heading">// about</h2>
          <p className="cd-help__body">
            AI Launcher Pro — Desktop launcher for AI coding CLIs.
          </p>
          <div className="cd-help__support">
            <Button
              variant="primary"
              size="sm"
              icon={<Icon icon={Coffee} size={14} weight="bold" />}
              onClick={() => void openLink("https://ko-fi.com/helbertmoura")}
            >
              {t("help.supportKofi")}
            </Button>
            <p className="cd-help__body cd-help__credit">
              Desenvolvido à base de ☕ e ⚡ por{" "}
              <button
                type="button"
                className="cd-help__author-link"
                onClick={() => void openLink("https://devmaniacs.com.br/")}
              >
                <strong>Dev Maniac&apos;s</strong>
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="cd-help__author-link"
                onClick={() => void openLink("https://linktr.ee/helbertmoura")}
              >
                <strong>Redes e contatos</strong>
              </button>
            </p>
          </div>
          <p className="cd-help__version">v{pkg.version} · MIT License</p>
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
