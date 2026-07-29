"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

function ResetPasswordPage() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t('resetPassword.tooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.mismatch'));
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('resetPassword.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] -z-10"></div>

      <Link href="/" className="mb-10 flex items-center gap-2">
        <img src="/logo-extended-dark.svg" alt="ORBIT" className="h-10 w-auto block dark:hidden" />
        <img src="/logo-extended.svg" alt="ORBIT" className="h-10 w-auto hidden dark:block" />
        <Badge variant="secondary" className="ml-2 text-[10px] font-medium tracking-wider uppercase">
          {'NEI-ISEP'}
        </Badge>
      </Link>

      <Card className="w-full max-w-[420px] shadow-lg border-border/60 bg-background/60 backdrop-blur-xl overflow-hidden pb-0">
        <CardHeader className="space-y-3 text-center pb-8 pt-8">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {t('resetPassword.title')}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {success ? t('resetPassword.successDescription') : t('resetPassword.description')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm text-muted-foreground">{t('resetPassword.success')}</p>
            </div>
          ) : !token ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-muted-foreground">{t('resetPassword.missingToken')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('resetPassword.newPasswordLabel')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-background"
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="confirm" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('resetPassword.confirmPasswordLabel')}
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11 bg-background"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base text-primary-foreground mt-4 shadow-sm text-black"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('login.processing')}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    {t('resetPassword.submit')}
                  </div>
                )}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col border-t border-border/40 px-4 sm:px-6 py-5 bg-muted/10">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/login")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('login.backToLogin')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ResetPasswordPageWrapper() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
