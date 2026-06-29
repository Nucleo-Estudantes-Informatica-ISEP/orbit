'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from '@/lib/locale-context';

interface SplashScreenProps {
  duration?: number;
  onComplete?: () => void;
  spinnerSize?: 'sm' | 'md' | 'lg';
}

export default function SplashScreen({ duration = 1000, onComplete, spinnerSize = 'md' }: SplashScreenProps) {
  const { t } = useLocale();
  const [isVisible, setIsVisible] = useState(true);
  const spinnerDimensions = spinnerSize === 'sm' ? 'h-6 w-6' : spinnerSize === 'lg' ? 'h-12 w-12' : 'h-8 w-8';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--primary)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={`rounded-full border-4 border-black border-t-transparent animate-spin ${spinnerDimensions}`}
          aria-hidden
        />
        <div className="text-base font-medium text-black">{t('common.loading')}</div>
      </div>
    </div>
  );
}
