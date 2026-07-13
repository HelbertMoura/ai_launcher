import { readKey, removeKey, writeKey } from "../lib/storage";

export const ONBOARDING_STORAGE_KEY = "ai-launcher:onboarding-done";

export function readOnboarded(): boolean {
  if (readKey("showOnboarding") === "true") return false;
  return readKey("onboardingDone") === "true";
}

export function markOnboarded(): void {
  writeKey("onboardingDone", "true");
}

export function readShowOnStartup(): boolean {
  return readKey("showOnboarding") === "true";
}

export function setShowOnStartup(value: boolean): void {
  if (value) writeKey("showOnboarding", "true");
  else removeKey("showOnboarding");
}
