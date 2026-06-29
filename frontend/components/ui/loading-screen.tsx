'use client';

import React from 'react';
import { useLocale } from '@/lib/locale-context';

interface LoadingScreenProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingScreen({ message, size = 'md' }: LoadingScreenProps) {
  const { t } = useLocale();
  const displayMessage = message ?? t('common.loading');
  const spinnerSize = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--primary)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={`rounded-full border-4 border-black border-t-transparent animate-spin ${spinnerSize}`}
          aria-hidden
        />
        <div className="text-base font-medium text-black">{displayMessage}</div>
      </div>
    </div>
  );
}
