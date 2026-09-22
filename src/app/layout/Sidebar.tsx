import { useTranslation } from "react-i18next";
import { Icon, type IconProps } from "../../ui/Icon";
import {
  CaretDown,
  CaretRight,
  ChartBar,
  Clock,
  Eye,
  Faders,
  FolderOpen,
  Gear,
  House,
  Key,
  Play,
  PlugsConnected,
  Question,
  Rocket,
  ShieldCheck,
  Star,
  Wrench,
} from "../../ui/icons";
import { TAB_KEYS, TAB_I18N_KEYS, type MaintenanceSection, type TabId } from "./TabId";
import {
  partitionSurfaces,
  useSidebarNav,
  type SidebarGroupId,
} from "./sidebarNav";
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
  onSelect: (id: TabId, section?: MaintenanceSection) => void;
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
  maintenance: ShieldCheck,
  admin: Gear,
  help: Question,
};

const GROUP_ICONS: Record<SidebarGroupId, IconProps["icon"]> = {
  run: Play,
  observe: Eye,
  connect: PlugsConnected,
  system: Faders,
};

export function Sidebar({ active, onSelect, version, indicators, collapsed = false, onToggleCollapsed, executionMode }: SidebarProps) {
  const { t } = useTranslation();
  const ind = indicators ?? {};
  const { pinned, collapsedGroups, togglePin, toggleGroup } = useSidebarNav();
  const layout = partitionSurfaces({ pinned, collapsedGroups });

  const renderItem = (id: TabId) => (
    <Item
      key={id}
      id={id}
      active={active}
      onSelect={onSelect}
      indicator={ind[id]}
      compact={collapsed}
      pinnable={id !== "command-center"}
      pinned={pinned.includes(id)}
      onTogglePin={togglePin}
    />
  );

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
        {renderItem("command-center")}

        {layout.pinned.length > 0 && (
          <div className="cd-side__group">
            <div className="cd-side__label">{t("nav.groupPinned")}</div>
            {layout.pinned.map(renderItem)}
          </div>
        )}

        {layout.groups.map(({ group, surfaces }) => {
          const isCollapsed = !collapsed && collapsedGroups.includes(group.id);
          return (
            <div className="cd-side__group" key={group.id}>
              <button
                type="button"
                className="cd-side__group-head"
                aria-expanded={!isCollapsed}
                aria-controls={`cd-side-group-${group.id}`}
                onClick={() => toggleGroup(group.id)}
                title={t(group.labelKey)}
              >
                <Icon icon={GROUP_ICONS[group.id]} size={13} aria-hidden />
                <span className="cd-side__label">{t(group.labelKey)}</span>
                <span className="cd-side__chevron" aria-hidden>
                  <Icon icon={isCollapsed ? CaretRight : CaretDown} size={11} />
                </span>
              </button>
              <div
                id={`cd-side-group-${group.id}`}
                className="cd-side__group-body"
                hidden={isCollapsed}
              >
                {surfaces.map(renderItem)}
              </div>
            </div>
          );
        })}
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
  pinnable,
  pinned,
  onTogglePin,
}: {
  id: TabId;
  active: TabId;
  onSelect: (id: TabId, section?: MaintenanceSection) => void;
  indicator?: SidebarIndicator;
  compact: boolean;
  pinnable: boolean;
  pinned: boolean;
  onTogglePin: (id: TabId) => void;
}) {
  const { t } = useTranslation();
  const isOn = id === active;
  const indicatorValue = compact && indicator ? compactIndicatorValue(indicator.value) : indicator?.value;
  const label = t(TAB_I18N_KEYS[id]);
  return (
    <div className="cd-side__row">
      <button
        type="button"
        aria-current={isOn ? "page" : undefined}
        className={`cd-side__item${isOn ? " cd-side__item--on" : ""}`}
        onClick={() => onSelect(id)}
        title={label}
      >
        <span className="cd-side__item-main">
          <Icon icon={TAB_ICONS[id]} size={18} weight={isOn ? "fill" : "regular"} />
          <span className="cd-side__item-name">{label}</span>
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
      {pinnable && (
        <button
          type="button"
          className={`cd-side__pin${pinned ? " cd-side__pin--on" : ""}`}
          aria-pressed={pinned}
          aria-label={t(pinned ? "nav.unpin" : "nav.pin", { name: label })}
          title={t(pinned ? "nav.unpin" : "nav.pin", { name: label })}
          onClick={() => onTogglePin(id)}
        >
          <Icon icon={Star} size={12} weight={pinned ? "fill" : "regular"} />
        </button>
      )}
    </div>
  );
}

function compactIndicatorValue(value: string) {
  const trimmed = value.trim();
  if (/^\d{1,2}$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return "9+";
  return "•";
}
