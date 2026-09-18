import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { InboxBell } from "./InboxBell";
import { __resetForTests, pushEvent } from "./inboxStore";

function seedInbox(): void {
  localStorage.clear();
  __resetForTests();
  pushEvent({
    id: "session:1",
    type: "session",
    titleKey: "inbox.sessionCompleted",
    titleParams: { cli: "Claude" },
    targetTab: "history",
    ts: Date.now(),
  });
  pushEvent({
    id: "doctor:git",
    type: "doctor",
    titleKey: "inbox.doctorTitle",
    titleParams: { name: "Git" },
    targetTab: "doctor",
    ts: Date.now(),
  });
}

beforeAll(async () => {
  await i18n.changeLanguage("pt-BR");
});

beforeEach(() => {
  localStorage.clear();
  __resetForTests();
});

describe("InboxBell", () => {
  it("mostra badge com a contagem de não lidas", () => {
    seedInbox();
    render(<InboxBell onNavigate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Abrir inbox (2 não lidas)" }),
    ).toBeInTheDocument();
    const badge = document.querySelector(".cd-inbox__badge");
    expect(badge).toHaveTextContent("2");
  });

  it("sem eventos não mostra badge e usa rótulo vazio", () => {
    render(<InboxBell onNavigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Abrir inbox" })).toBeInTheDocument();
    expect(document.querySelector(".cd-inbox__badge")).toBeNull();
  });

  it("abre o painel com os eventos ao clicar", () => {
    seedInbox();
    render(<InboxBell onNavigate={vi.fn()} />);
    const bell = screen.getByRole("button", { name: "Abrir inbox (2 não lidas)" });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(bell);
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByText("Sessão de Claude concluída")).toBeInTheDocument();
    expect(screen.getByText("Doctor: Git com problema")).toBeInTheDocument();
  });

  it("clicar num item marca como lida e navega para o alvo", () => {
    const onNavigate = vi.fn();
    seedInbox();
    render(<InboxBell onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir inbox (2 não lidas)" }));
    fireEvent.click(screen.getByText("Sessão de Claude concluída"));
    expect(onNavigate).toHaveBeenCalledWith("history");
    // Panel closes and the badge drops to the remaining unread event.
    expect(screen.queryByRole("dialog", { name: "Inbox" })).not.toBeInTheDocument();
    expect(document.querySelector(".cd-inbox__badge")).toHaveTextContent("1");
  });

  it("fecha o painel com Escape", () => {
    seedInbox();
    render(<InboxBell onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir inbox (2 não lidas)" }));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Inbox" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Inbox" })).not.toBeInTheDocument();
  });
});
