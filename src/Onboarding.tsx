import { useState } from 'react';
import { TerminalFrame } from './shared/TerminalFrame';
import { Terminal, CheckCircle2, ArrowUpRight } from './icons';
import './Onboarding.css';

const STEPS = ['welcome', 'detect', 'provider', 'launch'] as const;
type Step = typeof STEPS[number];

interface OnboardingProps {
  onClose: () => void;
}

export function Onboarding({ onClose }: OnboardingProps) {
  const [step, setStep] = useState<Step>('welcome');

  function handleFinish() {
    try { localStorage.setItem('ai-launcher:hide-welcome', '1'); } catch {}
    onClose();
  }

  function next() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
    else handleFinish();
  }

  return (
    <div className="onboarding">
      <div className="onboarding__inner">
        <div className="onboarding__progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`onboarding__dot${STEPS.indexOf(step) >= i ? ' is-reached' : ''}${step === s ? ' is-current' : ''}`}
            />
          ))}
        </div>
        <TerminalFrame>
          {step === 'welcome' && <WelcomeStep onNext={next} onSkip={handleFinish} />}
          {step === 'detect' && <DetectStep onNext={next} />}
          {step === 'provider' && <ProviderStep onNext={next} />}
          {step === 'launch' && <LaunchStep onFinish={handleFinish} />}
        </TerminalFrame>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="onboarding-step">
      <h1 className="onboarding-step__title">
        <Terminal size={20} strokeWidth={1.5} /> AI LAUNCHER
      </h1>
      <p className="onboarding-step__tagline">eight CLIs. one launcher.</p>
      <p className="onboarding-step__body">
        O AI Launcher Pro detecta as CLIs instaladas, alterna providers num clique
        e lança com o ambiente certo — direto do terminal dramático.
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>start</button>
        <button type="button" className="btn-ghost" onClick={onSkip}>skip tour</button>
      </div>
    </div>
  );
}

function DetectStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-step__prompt">&gt; detecting installed CLIs...</p>
      <ul className="onboarding-step__checklist">
        <li><CheckCircle2 size={14}/> <code>claude</code></li>
        <li><CheckCircle2 size={14}/> <code>codex</code></li>
        <li><CheckCircle2 size={14}/> <code>cursor-agent</code></li>
      </ul>
      <p className="onboarding-step__body">
        A lista real aparece na aba Launcher depois que você terminar o tour.
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>continue</button>
      </div>
    </div>
  );
}

function ProviderStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-step__prompt">&gt; choose provider</p>
      <div className="onboarding-step__radios">
        <label className="is-active"><input type="radio" name="ob-prov" defaultChecked /> Anthropic (oficial)</label>
        <label><input type="radio" name="ob-prov" /> Z.AI</label>
        <label><input type="radio" name="ob-prov" /> MiniMax</label>
      </div>
      <p className="onboarding-step__body">
        Configure tokens depois no Admin → Providers. Tokens ficam local only,
        zero telemetria.
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>continue</button>
      </div>
    </div>
  );
}

function LaunchStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="onboarding-step">
      <p className="onboarding-step__prompt">&gt; ready to launch</p>
      <p className="onboarding-step__body">
        Pressione <kbd>⌘</kbd> <kbd>K</kbd> pra abrir a paleta a qualquer hora,
        ou volte pra aba Launcher e selecione a CLI.
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onFinish}>
          <ArrowUpRight size={14} /> launch now
        </button>
      </div>
    </div>
  );
}
