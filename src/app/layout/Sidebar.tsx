import { useTranslation } from "react-i18next";
import { Icon, type IconProps } from "../../ui/Icon";
import { ArrowUp, ChartBar, Check, Clock, FolderOpen, Gear, House, Key, Question, Rocket, ShieldCheck, Wrench } from "../../ui/icons";
import { TAB_KEYS, TAB_I18N_KEYS, type TabId } from "./TabId";
import "./Sidebar.css";
import type { ExecutionMode } from "../../domain/executionMode";

export type IndicatorTone = "neutral" | "warn" | "accent";

export interface SidebarIndicator {
  value: string;
  tone: IndicatorTone;
}

export type SidebarIndicatorMap = Partial<Record<TabId, SidebarIndicator>>;

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  version: string;
  indicators?: SidebarIndicatorMap;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  executionMode: ExecutionMode;
}

const TAB_ICONS: Record<TabId, IconProps["icon"]> = {
  "command-center": House,
  launcher: Rocket,
  tools: Wrench,
  mcp: Key,
  history: Clock,
  costs: ChartBar,
  workspace: FolderOpen,
  doctor: ShieldCheck,
  updates: ArrowUp,
  prereqs: Check,
  admin: Gear,
  help: Question,
};

export function Sidebar({ active, onSelect, version, indicators, collapsed = false, onToggleCollapsed, executionMode }: SidebarProps) {
  const { t } = useTranslation();
  const ind = indicators ?? {};
  return (
    <aside className={`cd-side${collapsed ? " cd-side--collapsed" : ""}`}>
      <div className="cd-side__brand">
        <span className="cd-side__led" aria-hidden />
        <span className="cd-side__name">AI LAUNCHER</span>
        {onToggleCollapsed && (
          <button
            type="button"
            className="cd-side__collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
          >
            {collapsed ? "›" : "‹"}
          </button>
        )}
      </div>

      <nav className="cd-side__nav">
        <div className="cd-side__group">
          <div className="cd-side__label">{t("nav.groupWorkspace")}</div>
          <Item id="command-center" active={active} onSelect={onSelect} indicator={ind["command-center"]} compact={collapsed} />
          <Item id="launcher" active={active} onSelect={onSelect} indicator={ind.launcher} compact={collapsed} />
          <Item id="tools" active={active} onSelect={onSelect} indicator={ind.tools} compact={collapsed} />
          <Item id="mcp" active={active} onSelect={onSelect} indicator={ind.mcp} compact={collapsed} />
          <Item id="history" active={active} onSelect={onSelect} indicator={ind.history} compact={collapsed} />
          <Item id="costs" active={active} onSelect={onSelect} indicator={ind.costs} compact={collapsed} />
          <Item id="workspace" active={active} onSelect={onSelect} indicator={ind.workspace} compact={collapsed} />
          <Item id="doctor" active={active} onSelect={onSelect} indicator={ind.doctor} compact={collapsed} />
          <Item id="updates" active={active} onSelect={onSelect} indicator={ind.updates} compact={collapsed} />
          <Item id="prereqs" active={active} onSelect={onSelect} indicator={ind.prereqs} compact={collapsed} />
        </div>

        <div className="cd-side__group">
          <div className="cd-side__label">{t("nav.groupSystem")}</div>
          <Item id="admin" active={active} onSelect={onSelect} indicator={ind.admin} compact={collapsed} />
        </div>

        <div className="cd-side__group">
          <div className="cd-side__label">{t("nav.groupSupport")}</div>
          <Item id="help" active={active} onSelect={onSelect} indicator={ind.help} compact={collapsed} />
        </div>
      </nav>

      <div className="cd-side__foot">
        <div className={`cd-side__mode cd-side__mode--${executionMode}`}>
          <span aria-hidden />{t(`statusBar.modes.${executionMode}`)}
        </div>
        <div className="cd-side__ver">v{version}</div>
      </div>
    </aside>
  );
}

function Item({
  id,
  active,
  onSelect,
  indicator,
  compact,
}: {
  id: TabId;
  active: TabId;
  onSelect: (id: TabId) => void;
  indicator?: SidebarIndicator;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const isOn = id === active;
  const indicatorValue = compact && indicator ? compactIndicatorValue(indicator.value) : indicator?.value;
  return (
    <button
      type="button"
      aria-current={isOn ? "page" : undefined}
      className={`cd-side__item${isOn ? " cd-side__item--on" : ""}`}
      onClick={() => onSelect(id)}
      title={t(TAB_I18N_KEYS[id])}
    >
      <span className="cd-side__item-main">
        <Icon icon={TAB_ICONS[id]} size={18} weight={isOn ? "fill" : "regular"} />
        <span className="cd-side__item-name">{t(TAB_I18N_KEYS[id])}</span>
      </span>
      <span className="cd-side__item-trail">
        {indicator && (
          <span
            className={`cd-side__indicator cd-side__indicator--${indicator.tone}`}
            aria-hidden
            title={indicator.value}
          >
            {indicatorValue}
          </span>
        )}
        <span className="cd-side__item-key">{TAB_KEYS[id]}</span>
      </span>
    </button>
  );
}

function compactIndicatorValue(value: string) {
  const trimmed = value.trim();
  if (/^\d{1,2}$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return "9+";
  return "•";
}
