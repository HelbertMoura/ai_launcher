import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { ArrowUpRight } from '../icons';
import './StatusBar.css';

const CACHE_KEY = 'ai-launcher:latest-release-check';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface LatestRelease {
  tag_name: string;
  html_url: string;
}

function isNewer(current: string, latest: string): boolean {
  const c = current.replace(/^v/, '').split('.').map(Number);
  const l = latest.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

interface StatusBarProps {
  version: string;
  provider?: string;
  activeTab: string;
}

export function StatusBar({ version, provider, activeTab }: StatusBarProps) {
  const [latest, setLatest] = useState<LatestRelease | null>(null);

  useEffect(() => {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { ts: number; data: LatestRelease };
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          setLatest(parsed.data);
          return;
        }
      } catch {
        /* fall through */
      }
    }
    invoke<LatestRelease>('check_latest_release')
      .then((data) => {
        setLatest(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch {
          /* ignore quota */
        }
      })
      .catch(() => {
        /* silent — offline or rate limited */
      });
  }, []);

  const updateAvailable = latest ? isNewer(version, latest.tag_name) : false;

  function openRelease(e: React.MouseEvent) {
    e.preventDefault();
    if (!latest) return;
    openUrl(latest.html_url).catch(() => {});
  }

  return (
    <footer className="statusbar" aria-label="Status bar">
      <span className="statusbar__item">[ai-launcher {version}]</span>
      {provider && <span className="statusbar__item">● {provider}</span>}
      <span className="statusbar__item statusbar__tab">tab: {activeTab}</span>
      <span className="statusbar__spacer" aria-hidden="true" />
      {updateAvailable && latest && (
        <a href="#" className="statusbar__update" onClick={openRelease}>
          <ArrowUpRight size={12} /> {latest.tag_name} available
        </a>
      )}
    </footer>
  );
}
