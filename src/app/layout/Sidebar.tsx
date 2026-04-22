import { Chip } from "../../ui/Chip";
import { TAB_KEYS, TAB_LABELS, type TabId } from "./TabId";
import "./Sidebar.css";

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  version: string;
}

export function Sidebar({ active, onSelect, version }: SidebarProps) {
  return (
    <aside className="cd-side">
      <div className="cd-side__brand">
        <span className="cd-side__led" aria-hidden />
        <span className="cd-side__name">AI LAUNCHER</span>
      </div>

      <nav className="cd-side__nav">
        <div className="cd-side__group">
          <div className="cd-side__label">Workspace</div>
          <Item id="launcher" active={active} onSelect={onSelect} />
          <Item id="tools" active={active} onSelect={onSelect} />
          <Item id="history" active={active} onSelect={onSelect} />
          <Item id="costs" active={active} onSelect={onSelect} />
        </div>

        <div className="cd-side__group">
          <div className="cd-side__label">System</div>
          <Item id="admin" active={active} onSelect={onSelect} />
        </div>

        <div className="cd-side__group">
          <div className="cd-side__label">Support</div>
          <Item id="help" active={active} onSelect={onSelect} />
        </div>
      </nav>

      <div className="cd-side__foot">
        <Chip variant="admin" dot>Admin · full access</Chip>
        <div className="cd-side__ver">v{version}</div>
      </div>
    </aside>
  );
}

function Item({
  id,
  active,
  onSelect,
}: {
  id: TabId;
  active: TabId;
  onSelect: (id: TabId) => void;
}) {
  const isOn = id === active;
  return (
    <button
      type="button"
      className={`cd-side__item${isOn ? " cd-side__item--on" : ""}`}
      onClick={() => onSelect(id)}
    >
      <span className="cd-side__item-name">{TAB_LABELS[id]}</span>
      <span className="cd-side__item-key">{TAB_KEYS[id]}</span>
    </button>
  );
}
