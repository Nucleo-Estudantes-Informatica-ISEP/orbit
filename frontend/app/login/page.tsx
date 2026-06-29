"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogIn, Mail, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import LoadingScreen from '@/components/ui/loading-screen';
import SplashScreen from '@/components/ui/splash-screen';
import { useLocale } from '@/lib/locale-context';

export default function LoginPage() {
  const { login, isLoading: authLoading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      setShowSplash(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.invalidCredentials'));
      setIsLoading(false);
    }
  };

  if (isLoading && showSplash) {
    return (
      <SplashScreen
        duration={500}
        onComplete={() => {
          router.push("/dashboard");
        }}
      />
    );
  }

  if (isLoading) {
    return <LoadingScreen message={t('login.signingIn')} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10"></div>

      {/* BRANDING / LOGO (No hover animation) */}
      <Link href="/" className="mb-10 flex items-center gap-2">
        <img src="/logo-extended.svg" alt="ORBIT" className="h-10 w-auto" />
        <Badge variant="secondary" className="ml-2 text-[10px] font-medium tracking-wider uppercase">
          {'NEI-ISEP'}
        </Badge>
      </Link>

      {/* LOGIN / RESET CARD */}
      <Card className="w-full max-w-[420px] shadow-lg border-border/60 bg-background/60 backdrop-blur-xl overflow-hidden pb-0">
        <CardHeader className="space-y-3 text-center pb-8 pt-8">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {isResetMode ? t('login.resetPassword') : t('login.welcomeBack')}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {isResetMode
              ? t('login.resetDescription')
              : t('login.workspaceDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && !isResetMode && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('login.emailLabel')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@nei-isep.org"
                required
                disabled={isLoading || authLoading || isResetMode}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-background"
              />
            </div>

            {!isResetMode && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('login.passwordLabel')}
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs font-medium text-primary hover:text-primary/80"
                    onClick={() => {
                      setIsResetMode(true);
                      setError("");
                    }}
                  >
                    {t('login.forgotPassword')}
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isLoading || authLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-background"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base text-primary-foreground mt-4 shadow-sm text-black"
              disabled={isLoading || authLoading || isResetMode}
            >
              {isLoading || authLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('login.processing')}
                </div>
              ) : isResetMode ? (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('login.sendLink')}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  {t('login.loginToOrbit')}
                </div>
              )}
            </Button>
          </form>
        </CardContent>

        {/* Removed mt-2 and rounded-b-xl, pb-0 on parent Card fixes the spacing */}
        <CardFooter className="flex flex-col border-t border-border/40 px-6 py-5 bg-muted/10">
          {isResetMode ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setIsResetMode(false);
                setError("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('login.backToLogin')}
            </Button>
          ) : (
            <div className="text-center text-xs text-muted-foreground/80 leading-relaxed space-y-1">
              <p>{t('login.footer')}</p>
              <p>
                <Link href="/privacy" className="hover:text-foreground underline underline-offset-2">
                  {t('home.privacy')}
                </Link>
                <span className="mx-2">&middot;</span>
                <Link href="/terms" className="hover:text-foreground underline underline-offset-2">
                  {t('home.terms')}
                </Link>
              </p>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}