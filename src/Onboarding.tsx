import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CheckCircle2, ArrowUpRight } from './icons';
import './Onboarding.css';

const STEPS = ['welcome', 'detect', 'autoDetect', 'tour', 'launch'] as const;
type Step = typeof STEPS[number];

const TOUR_SLIDES = [
  'launcher',
  'install',
  'tools',
  'history',
  'costs',
  'palette',
  'admin',
  'help',
  'updates',
] as const;
type TourSlide = typeof TOUR_SLIDES[number];

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
    <div className="onb-overlay">
      <div className="onb-modal">
        <div className="onb-progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`onb-dot${STEPS.indexOf(step) >= i ? ' onb-dot--done' : ''}${step === s ? ' onb-dot--active' : ''}`}
            />
          ))}
        </div>
        <div className="onb-step">
          {step === 'welcome' && <WelcomeStep onNext={next} onSkip={handleFinish} />}
          {step === 'detect' && <DetectStep onNext={next} />}
          {step === 'autoDetect' && <AutoDetectStep onNext={next} />}
          {step === 'tour' && <TourStep onNext={next} onSkip={handleFinish} />}
          {step === 'launch' && <LaunchStep onFinish={handleFinish} />}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="onb-step onb-step--left">
      <h1 className="onb-title">{t('onboarding.welcome.brand')}</h1>
      <p className="onb-tagline">{t('onboarding.welcome.tagline')}</p>
      <p className="onb-body">{t('onboarding.welcome.body')}</p>
      <div className="onb-actions onb-actions--left">
        <button type="button" className="onb-btn onb-btn--primary" onClick={onNext}>{t('onboarding.welcome.start')}</button>
        <button type="button" className="onb-btn onb-btn--ghost" onClick={onSkip}>{t('onboarding.welcome.skip')}</button>
      </div>
    </div>
  );
}

function DetectStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="onb-step">
      <p className="onb-tagline">{t('onboarding.detect.prompt')}</p>
      <ul className="onb-bullets">
        <li><CheckCircle2 size={14}/> <code>claude</code></li>
        <li><CheckCircle2 size={14}/> <code>codex</code></li>
        <li><CheckCircle2 size={14}/> <code>cursor-agent</code></li>
      </ul>
      <p className="onb-body">{t('onboarding.detect.body')}</p>
      <div className="onb-actions">
        <button type="button" className="onb-btn onb-btn--primary" onClick={onNext}>{t('onboarding.detect.continue')}</button>
      </div>
    </div>
  );
}

function AutoDetectStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const envKey = (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ?? '';
  const hasKey = envKey.length > 10;
  return (
    <div className="onb-step">
      <p className="onb-tagline">{t('onboarding.autoDetect.prompt')}</p>
      <p className="onb-body">
        {hasKey
          ? t('onboarding.autoDetect.found', { key: envKey.slice(0, 8) + '•••' })
          : t('onboarding.autoDetect.notFound')}
      </p>
      <div className="onb-actions">
        <button type="button" className="onb-btn onb-btn--primary" onClick={onNext}>
          {hasKey ? t('onboarding.autoDetect.useBtn') : t('onboarding.autoDetect.skipBtn')}
        </button>
      </div>
    </div>
  );
}

function TourStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const slide: TourSlide = TOUR_SLIDES[idx];
  const isLast = idx === TOUR_SLIDES.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (!isLast) setIdx((i) => i + 1);
        else onNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (idx > 0) setIdx((i) => i - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isLast) onNext();
        else setIdx((i) => i + 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, isLast, onNext, onSkip]);

  return (
    <div className="onb-step">
      <p className="onb-tagline">{t('onboarding.tour.title')}</p>
      <div className="onb-tour-slide">
        <h3 className="onb-tour-title">{t(`onboarding.tour.slides.${slide}.title`)}</h3>
        <p className="onb-tour-body">{t(`onboarding.tour.slides.${slide}.body`)}</p>
      </div>
      <div className="onb-tour-dots" aria-label="Slide progress">
        {TOUR_SLIDES.map((s, i) => (
          <span
            key={s}
            className={`onb-tour-dot${i === idx ? ' onb-tour-dot--active' : ''}${i < idx ? ' onb-tour-dot--done' : ''}`}
          />
        ))}
      </div>
      <p className="onb-body">{t('onboarding.tour.body')}</p>
      <div className="onb-actions onb-tour-actions">
        <button
          type="button"
          className="onb-btn onb-btn--ghost"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          {t('onboarding.tour.prev')}
        </button>
        <button type="button" className="onb-btn onb-btn--ghost" onClick={onSkip}>
          {t('onboarding.tour.skip')}
        </button>
        <button
          type="button"
          className="onb-btn onb-btn--primary"
          onClick={() => (isLast ? onNext() : setIdx((i) => i + 1))}
        >
          {isLast ? t('onboarding.tour.done') : t('onboarding.tour.next')}
        </button>
      </div>
    </div>
  );
}

function LaunchStep({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="onb-step">
      <p className="onb-tagline">{t('onboarding.launch.prompt')}</p>
      <p className="onb-body">
        <Trans
          i18nKey="onboarding.launch.body"
          values={{ cmd: '⌘', k: 'K' }}
          components={{ 1: <kbd />, 2: <kbd /> }}
        />
      </p>
      <div className="onb-actions">
        <button type="button" className="onb-btn onb-btn--primary" onClick={onFinish}>
          <ArrowUpRight size={14} /> {t('onboarding.launch.cta')}
        </button>
      </div>
    </div>
  );
}