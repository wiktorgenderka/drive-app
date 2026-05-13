'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'driveapp_onboarding_done';

interface Step {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  action?: { label: string; onClick: () => void | Promise<void> };
  accentColor: string;
}

function useOnboardingSteps(onDone: () => void): Step[] {
  return [
    {
      emoji: '🚗',
      title: 'Witaj w DriveApp!',
      subtitle: 'Twoja nowa droga zaczyna się tutaj',
      description: 'Jedyna aplikacja dla kierowców łącząca mapę, konwoje, gamifikację i społeczność w jednym miejscu.',
      accentColor: 'from-orange-500 to-orange-600',
    },
    {
      emoji: '📍',
      title: 'Włącz lokalizację',
      subtitle: 'Potrzebujemy GPS do pełnego działania',
      description: 'Lokalizacja pozwala na śledzenie jazdy, dołączanie do konwojów i widzenie raportów drogowych w pobliżu.',
      action: {
        label: 'Zezwól na GPS',
        onClick: () => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(() => {}, () => {});
          }
        },
      },
      accentColor: 'from-emerald-500 to-emerald-600',
    },
    {
      emoji: '🏆',
      title: 'System XP i rang',
      subtitle: 'Jeździj, zdobywaj, awansuj',
      description: 'Za każdą trasę, raport i aktywność dostajesz XP. Zbieraj odznaki i wspinaj się od Debiutanta aż po Road God!',
      accentColor: 'from-amber-500 to-orange-500',
    },
    {
      emoji: '👥',
      title: 'Konwoje i społeczność',
      subtitle: 'Podróż razem jest lepsza',
      description: 'Twórz konwoje ze znajomymi, śledź ich pozycję na żywo, komunikuj się głosowo i dziel się trasami.',
      accentColor: 'from-violet-500 to-violet-600',
    },
    {
      emoji: '🔥',
      title: 'Gotowy do jazdy!',
      subtitle: 'Zaczynamy przygodę',
      description: 'Twój profil jest skonfigurowany. Dodaj pierwsze auto do garażu i zacznij zdobywać XP za każdą jazdę!',
      action: {
        label: 'Start — dodaj auto',
        onClick: onDone,
      },
      accentColor: 'from-accent to-orange-600',
    },
  ];
}

export default function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const steps = useOnboardingSteps(onDone);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  function advance() {
    if (isLast) {
      handleDone();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }

  function handleDone() {
    localStorage.setItem(STORAGE_KEY, 'true');
    onDone();
  }

  function handleAction() {
    current.action?.onClick();
    advance();
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 60 : -60, scale: 0.96 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -60 : 60, scale: 0.96 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-safe"
    >
      {/* Skip */}
      <div className="flex w-full max-w-sm items-center justify-between pt-6">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              animate={{ width: i === step ? 24 : 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`h-1.5 rounded-full transition-colors ${i === step ? 'bg-accent' : i < step ? 'bg-accent/40' : 'bg-card-border'}`}
            />
          ))}
        </div>
        {!isLast && (
          <button
            onClick={handleDone}
            className="text-sm text-muted transition hover:text-foreground"
          >
            Pomiń
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            {/* Icon */}
            <div className={`flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-gradient-to-br ${current.accentColor} shadow-2xl`}>
              <span className="text-6xl">{current.emoji}</span>
            </div>

            {/* Text */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
                {current.subtitle}
              </p>
              <h2 className="mb-3 text-3xl font-black text-foreground leading-tight">
                {current.title}
              </h2>
              <p className="text-base text-muted leading-relaxed">
                {current.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex w-full max-w-sm flex-col gap-3 pb-10">
        {current.action ? (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAction}
              className={`w-full rounded-2xl bg-gradient-to-r ${current.accentColor} py-4 text-base font-bold text-white shadow-xl transition`}
            >
              {current.action.label}
            </motion.button>
            {!isLast && (
              <button
                onClick={advance}
                className="py-2 text-sm text-muted transition hover:text-foreground"
              >
                Zrób to później →
              </button>
            )}
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={advance}
            className={`w-full rounded-2xl bg-gradient-to-r ${current.accentColor} py-4 text-base font-bold text-white shadow-xl transition`}
          >
            {isLast ? 'Zacznij przygodę!' : 'Dalej →'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function useShowOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShow(true);
  }, []);

  function dismiss() { setShow(false); }

  return { show, dismiss };
}
