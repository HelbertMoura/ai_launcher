// ==============================================================================
// AI Launcher Pro - AdminTab
// Extraído de App.tsx. JSX IDÊNTICO ao original (envolve AdminPanel).
// ==============================================================================

import { AdminPanel } from '../providers/AdminPanel';
import type { ProvidersState } from '../providers/types';

export interface AdminTabProps {
  adminMode: boolean;
  providers: ProvidersState;
  updateProviders: (next: ProvidersState) => void;
  showToast: (msg: string) => void;
}

export function AdminTab({ adminMode, providers, updateProviders, showToast }: AdminTabProps) {
  if (!adminMode) return null;
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
