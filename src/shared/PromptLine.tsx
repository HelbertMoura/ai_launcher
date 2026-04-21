import type { ReactNode } from 'react';

interface PromptLineProps {
  children: ReactNode;
  prompt?: string;
  muted?: boolean;
}

export function PromptLine({ children, prompt = '>', muted = false }: PromptLineProps) {
  return (
    <span style={{ fontFamily: 'var(--ff-mono)', color: muted ? 'var(--text-muted)' : 'var(--text-prompt)' }}>
      <span style={{ marginRight: 8, color: 'var(--text-prompt)' }}>{prompt}</span>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{children}</span>
    </span>
  );
}
