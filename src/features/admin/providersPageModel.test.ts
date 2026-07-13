import { describe, expect, it } from "vitest";
import { SECRET_KEY_MARKER } from "../../providers/seeds";
import type { ProviderProfile, ProvidersState } from "../../providers/types";
import { buildProvidersOverview } from "./providersPageModel";

const profile = (id: string, builtin: boolean, apiKey = ""): ProviderProfile => ({
  id,
  name: id === "anthropic" ? "Anthropic" : "Team gateway",
  kind: id === "anthropic" ? "anthropic" : "custom",
  baseUrl: "",
  apiKey,
  mainModel: "model-main",
  fastModel: "model-fast",
  contextWindow: 200_000,
  builtin,
});

describe("buildProvidersOverview", () => {
  it("reports the active provider and credentials kept in secure storage", () => {
    const state: ProvidersState = {
      profiles: [
        profile("anthropic", true),
        profile("gateway", false, SECRET_KEY_MARKER),
      ],
      activeId: "gateway",
    };

    expect(buildProvidersOverview(state)).toEqual({
      total: 2,
      custom: 1,
      protectedCredentials: 1,
      activeName: "Team gateway",
    });
  });
});
