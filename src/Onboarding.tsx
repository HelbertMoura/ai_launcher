import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="onboarding-step">
      <h1 className="onboarding-step__title">
        <Terminal size={20} strokeWidth={1.5} /> {t('onboarding.welcome.brand')}
      </h1>
      <p className="onboarding-step__tagline">{t('onboarding.welcome.tagline')}</p>
      <p className="onboarding-step__body">
        {t('onboarding.welcome.body')}
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>{t('onboarding.welcome.start')}</button>
        <button type="button" className="btn-ghost" onClick={onSkip}>{t('onboarding.welcome.skip')}</button>
      </div>
    </div>
  );
}

function DetectStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-step">
      <p className="onboarding-step__prompt">{t('onboarding.detect.prompt')}</p>
      <ul className="onboarding-step__checklist">
        <li><CheckCircle2 size={14}/> <code>claude</code></li>
        <li><CheckCircle2 size={14}/> <code>codex</code></li>
        <li><CheckCircle2 size={14}/> <code>cursor-agent</code></li>
      </ul>
      <p className="onboarding-step__body">
        {t('onboarding.detect.body')}
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>{t('onboarding.detect.continue')}</button>
      </div>
    </div>
  );
}

function ProviderStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-step">
      <p className="onboarding-step__prompt">{t('onboarding.provider.prompt')}</p>
      <div className="onboarding-step__radios">
        <label className="is-active"><input type="radio" name="ob-prov" defaultChecked /> {t('onboarding.provider.optionAnthropic')}</label>
        <label><input type="radio" name="ob-prov" /> {t('onboarding.provider.optionZai')}</label>
        <label><input type="radio" name="ob-prov" /> {t('onboarding.provider.optionMinimax')}</label>
      </div>
      <p className="onboarding-step__body">
        {t('onboarding.provider.body')}
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>{t('onboarding.provider.continue')}</button>
      </div>
    </div>
  );
}

function LaunchStep({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="onboarding-step">
      <p className="onboarding-step__prompt">{t('onboarding.launch.prompt')}</p>
      <p className="onboarding-step__body">
        <Trans
          i18nKey="onboarding.launch.body"
          values={{ cmd: '\u2318', k: 'K' }}
          components={{ 1: <kbd />, 2: <kbd /> }}
        />
      </p>
      <div className="onboarding-step__actions">
        <button type="button" className="btn btn-primary" onClick={onFinish}>
          <ArrowUpRight size={14} /> {t('onboarding.launch.cta')}
        </button>
      </div>
    </div>
  );
}
