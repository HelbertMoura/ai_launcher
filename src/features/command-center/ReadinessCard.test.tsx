import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { ReadinessCard } from "./ReadinessCard";
import type { ReadinessCard as ReadinessCardModel } from "./commandCenterModel";

function makeCard(overrides?: Partial<ReadinessCardModel>): ReadinessCardModel {
  return {
    id: "clis",
    labelKey: "commandCenter.cardClis",
    value: "2/3",
    detailKey: "commandCenter.cardInstalled",
    tone: "ok",
    targetTab: "launcher",
    ...overrides,
  };
}

beforeAll(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("ReadinessCard", () => {
  it("renderiza rótulo, valor e detalhe com props reais", () => {
    render(<ReadinessCard card={makeCard()} onNavigate={vi.fn()} />);
    expect(screen.getByText("CLIs")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("instaladas")).toBeInTheDocument();
  });

  it("traduz valores simbólicos (Ready/None)", () => {
    render(
      <>
        <ReadinessCard card={makeCard({ value: "Ready" })} onNavigate={vi.fn()} />
        <ReadinessCard
          card={makeCard({ id: "workspace", labelKey: "commandCenter.cardWorkspace", value: "None" })}
          onNavigate={vi.fn()}
        />
      </>,
    );
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    expect(screen.getByText("Nenhum")).toBeInTheDocument();
  });

  it("interpola os parâmetros do detalhe", () => {
    render(
      <ReadinessCard
        card={makeCard({
          id: "workspace",
          labelKey: "commandCenter.cardWorkspace",
          value: "meu-projeto",
          detailKey: "commandCenter.cardWorkspacePath",
          detailParams: { path: "C:\\projetos\\meu-projeto" },
        })}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText("C:\\projetos\\meu-projeto")).toBeInTheDocument();
  });

  it("navega para a aba alvo ao clicar no cartão", () => {
    const onNavigate = vi.fn();
    render(<ReadinessCard card={makeCard()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("CLIs"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("launcher", undefined);
  });
});
