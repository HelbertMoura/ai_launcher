import { SECRET_KEY_MARKER } from "../../providers/seeds";
import type { ProvidersState } from "../../providers/types";

export interface ProvidersOverview {
  total: number;
  custom: number;
  protectedCredentials: number;
  activeName: string;
}

export function buildProvidersOverview(state: ProvidersState): ProvidersOverview {
  return {
    total: state.profiles.length,
    custom: state.profiles.filter((profile) => !profile.builtin).length,
    protectedCredentials: state.profiles.filter(
      (profile) => profile.apiKey === SECRET_KEY_MARKER,
    ).length,
    activeName:
      state.profiles.find((profile) => profile.id === state.activeId)?.name ??
      state.activeId,
  };
}
