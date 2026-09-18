import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Theme } from "../../hooks/useTheme";
import i18n from "../../i18n";
import { CommandPalette } from "./CommandPalette";

async function renderPalette(overrides?: Partial<Parameters<typeof CommandPalette>[0]>) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    theme: "dark" as Theme,
    onToggleTheme: vi.fn(),
    accent: "amber" as const,
    onSetAccent: vi.fn(),
    ...overrides,
  };
  const view = render(<CommandPalette {...props} />);
  return { view, props };
}

/** Option rows carry icon + label + shortcut; the label span alone is stable. */
function optionByLabel(label: string): HTMLElement | undefined {
  return screen
    .queryAllByRole("option")
    .find((o) => o.querySelector(".cd-cmd__label")?.textContent === label);
}

beforeAll(async () => {
  await i18n.changeLanguage("pt-BR");
});

beforeEach(() => {
  localStorage.clear();
});

describe("CommandPalette", () => {
  it("não renderiza nada quando fechada", () => {
    renderPalette({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre como diálogo com as opções de navegação", async () => {
    await renderPalette();
    expect(screen.getByRole("dialog", { name: "Comando" })).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    expect(optionByLabel("Lançar")).toBeTruthy();
    expect(optionByLabel("Histórico")).toBeTruthy();
  });

  it("filtra comandos pela consulta digitada", async () => {
    await renderPalette();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "histor" } });
    expect(optionByLabel("Histórico")).toBeTruthy();
    expect(optionByLabel("Lançar")).toBeUndefined();
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nenhum comando encontrado")).toBeInTheDocument();
  });

  it("executa o comando selecionado com Enter", async () => {
    const { props, view } = await renderPalette();
    // First row is selected: Enter runs "Command Center" and closes.
    fireEvent.keyDown(view.container.querySelector(".cd-cmd")!, { key: "Enter" });
    expect(props.onNavigate).toHaveBeenCalledWith("command-center");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("move a seleção com ArrowDown e executa com Enter", async () => {
    const { props, view } = await renderPalette();
    fireEvent.keyDown(view.container.querySelector(".cd-cmd")!, { key: "ArrowDown" });
    const launcher = optionByLabel("Lançar")!;
    expect(launcher).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(view.container.querySelector(".cd-cmd")!, { key: "Enter" });
    expect(props.onNavigate).toHaveBeenCalledWith("launcher");
  });

  it("fecha com Escape", async () => {
    const { props, view } = await renderPalette();
    fireEvent.keyDown(view.container.querySelector(".cd-cmd")!, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
