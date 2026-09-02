'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileViewer } from '@/components/authenticated-file';
import { useProtectedRoute } from '@/lib/use-protected-route';

function FilePage() {
  const params = useSearchParams();
  const isLoading = useProtectedRoute();
  if (isLoading) return null;
  return <FileViewer fileKey={params.get('key') ?? ''} />;
}

export default function Page() {
  return <Suspense><FilePage /></Suspense>;
}
