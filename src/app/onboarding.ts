export const ONBOARDING_STORAGE_KEY = "ai-launcher:onboarding-done";

export function readOnboarded(): boolean {
  try {
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
