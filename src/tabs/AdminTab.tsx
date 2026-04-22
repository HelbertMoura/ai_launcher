// ==============================================================================
// AI Launcher Pro - AdminTab
// Extraído de App.tsx. JSX IDÊNTICO ao original (envolve AdminPanel).
// ==============================================================================

import { AdminPanel } from '../providers/AdminPanel';
import type { ProvidersState } from '../providers/types';

export interface AdminTabProps {
  providers: ProvidersState;
  updateProviders: (next: ProvidersState) => void;
  showToast: (msg: string) => void;
}

export function AdminTab({ providers, updateProviders, showToast }: AdminTabProps) {
  return (
    <div className="tab-scroll">
      <div className="tab-pad">
        <AdminPanel
          state={providers}
          onChange={updateProviders}
          onToast={showToast}
        />
      </div>
    </div>
  );
}
