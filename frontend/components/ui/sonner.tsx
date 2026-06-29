'use client';

import { Toaster as Sonner, ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={{ '--toast-radius': 'var(--radius)' } as React.CSSProperties}
      {...props}
    />
  );
}

export { Toaster };
