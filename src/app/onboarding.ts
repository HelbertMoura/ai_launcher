export const ONBOARDING_STORAGE_KEY = "ai-launcher:onboarding-done";
const SHOW_ON_STARTUP_KEY = "ai-launcher:show-onboarding";

export function readOnboarded(): boolean {
  try {
    if (localStorage.getItem(SHOW_ON_STARTUP_KEY) === "true") return false;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    /* ignore storage errors */
  }
}

export function readShowOnStartup(): boolean {
  try {
    return localStorage.getItem(SHOW_ON_STARTUP_KEY) === "true";
  } catch {
    return false;
  }
}

export function setShowOnStartup(value: boolean): void {
  try {
    localStorage.setItem(SHOW_ON_STARTUP_KEY, value ? "true" : "false");
  } catch {
    /* ignore storage errors */
  }
}
