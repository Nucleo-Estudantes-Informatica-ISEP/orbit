'use client';

import { useState, useEffect } from 'react';
import { useProtectedRoute } from '@/lib/use-protected-route';
import { useAuth } from '@/lib/auth-context';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import LoadingScreen from '@/components/ui/loading-screen';
import SplashScreen from '@/components/ui/splash-screen';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLoading = useProtectedRoute();
  const { user } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading && !showContent) {
      setShowSplash(true);
    }
  }, [isLoading, showContent]);

  if (isLoading) {
    return <LoadingScreen message="Loading..." size="lg" />;
  }

  if (showSplash) {
    return (
      <SplashScreen
        duration={500}
        onComplete={() => {
          setShowSplash(false);
          setShowContent(true);
        }}
      />
    );
  }

  if (!showContent) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row bg-background text-foreground selection:bg-primary/20 selection:text-primary overflow-hidden">
      <DashboardSidebar
        userName={user?.name || 'User'}
        userRole={user?.roles?.[0] || 'Member'}
        userInitials={user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || 'U'}
      />
      <main className="flex-1 overflow-auto bg-muted/20 w-full relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}