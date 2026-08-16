import Image from 'next/image';

import { cn } from '@/lib/utils';

export function OrbitLogo({ className = 'h-8' }: { className?: string }) {
  const sharedClassName = cn('w-auto', className);

  return (
    <>
      <Image
        src="/logo-extended-dark.svg"
        alt="ORBIT"
        width={1282}
        height={468}
        className={cn(sharedClassName, 'block dark:hidden')}
        priority
      />
      <Image
        src="/logo-extended.svg"
        alt="ORBIT"
        width={1282}
        height={468}
        className={cn(sharedClassName, 'hidden dark:block')}
        priority
      />
    </>
  );
}
