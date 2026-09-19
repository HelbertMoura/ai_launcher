// ==============================================================================
// AI Launcher Pro - Secure storage availability hook
// Exposes the OS credential vault state to credential-bearing sections so they
// can fail closed (disabled + actionable warning) when the vault is missing.
// The probe itself is cached inside lib/secrets.ts; this hook only observes it.
// ==============================================================================

import { useEffect, useState } from 'react';
import { hasSecureStorage } from './secrets';

export type SecureStorageStatus = 'checking' | 'available' | 'unavailable';

/**
 * Current availability of the OS credential vault.
 * - `checking`: probe still in flight (credential actions stay disabled).
 * - `available`: vault present — UI behaves as usual.
 * - `unavailable`: vault missing — credential actions stay disabled with an
 *   actionable warning; nothing is ever written as plaintext.
 */
export function useSecureStorage(): SecureStorageStatus {
  const [status, setStatus] = useState<SecureStorageStatus>('checking');
  useEffect(() => {
    let cancelled = false;
    // hasSecureStorage never rejects (internal try/catch) — always resolves.
    hasSecureStorage().then((available) => {
      if (!cancelled) setStatus(available ? 'available' : 'unavailable');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

/**
 * Whether the current OS is Linux-like (desktop). Used to tailor the
 * actionable hint shown when the Secret Service vault is unavailable.
 */
export function isLinuxLikePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent);
}
