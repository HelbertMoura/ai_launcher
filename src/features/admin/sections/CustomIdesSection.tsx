import { useEffect, useState } from "react";
import { Button } from "../../../ui/Button";
import { Card } from "../../../ui/Card";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import {
  addCustomIde,
  CUSTOM_IDES_CHANGED_EVENT,
  loadCustomIdes,
  removeCustomIde,
  saveCustomIdes,
  type CustomIde,
} from "../../../lib/customIdes";
import { CustomIdeEditor } from "../editors/CustomIdeEditor";

export function CustomIdesSection() {
  const [ides, setIdes] = useState<CustomIde[]>(() => loadCustomIdes());
  const [editing, setEditing] = useState<CustomIde | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomIde | null>(null);

  useEffect(() => {
    const onChange = () => setIdes(loadCustomIdes());
    window.addEventListener(CUSTOM_IDES_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(CUSTOM_IDES_CHANGED_EVENT, onChange);
  }, []);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (ide: CustomIde) => {
    setEditing(ide);
    setOpen(true);
  };

  const handleSave = (ide: CustomIde) => {
    const next = addCustomIde(ides, ide);
    saveCustomIdes(next);
    setIdes(next);
    setOpen(false);
    setEditing(null);
  };

  const handleDelete = (ide: CustomIde) => {
    setConfirmDelete(ide);
  };

  const confirmDeleteIde = () => {
    if (!confirmDelete) return;
    const next = removeCustomIde(ides, confirmDelete.key);
    saveCustomIdes(next);
    setIdes(next);
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="cd-admin-section__head">
        <div>
          <h3 className="cd-admin-section__title">Custom IDEs</h3>
          <p className="cd-admin-section__sub">
            {ides.length} custom IDE{ides.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          + Add custom IDE
        </Button>
      </div>

      {ides.length === 0 ? (
        <div className="cd-page__empty">No custom IDEs yet.</div>
      ) : (
        <div className="cd-page__grid">
          {ides.map((ide) => (
            <Card key={ide.key}>
              <div className="cd-admin-card">
                <div className="cd-admin-card__name">
                  {ide.iconEmoji ? `${ide.iconEmoji} ` : ""}
                  {ide.name}
                </div>
                <div className="cd-admin-card__detail">key: {ide.key}</div>
                <div className="cd-admin-card__detail">
                  launch: <code>{ide.launchCmd}</code>
                </div>
                {ide.detectCmd && (
                  <div className="cd-admin-card__detail">
                    detect: <code>{ide.detectCmd}</code>
                  </div>
                )}
                <div className="cd-admin-card__actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(ide)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(ide)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CustomIdeEditor
        open={open}
        ide={editing}
        existingKeys={ides.map((i) => i.key)}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        variant="danger"
        title="Delete Custom IDE"
        message={`Delete custom IDE "${confirmDelete?.name ?? ""}"?`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteIde}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
