'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowRight, 
  LayoutDashboard,
  Users, 
  Briefcase, 
  MessageSquare, 
  Calendar, 
  Bell,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useLocale, type AppLocale } from '@/lib/locale-context';

export default function Home() {
  const { locale, setLocale, t } = useLocale();

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === 'pt' || nextLocale === 'en') {
      void setLocale(nextLocale as AppLocale);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src="/logo-extended-dark.svg" alt="ORBIT" className="h-8 w-auto block dark:hidden" />
            <img src="/logo-extended.svg" alt="ORBIT" className="h-8 w-auto hidden dark:block" />
            <Badge variant="secondary" className="ml-2 text-[10px] font-medium tracking-wider uppercase">
              {'NEI-ISEP'}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <Button asChild className="rounded-full px-6 font-medium shadow-sm text-black">
              <Link href="/login">{t('home.login')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-24 pb-32 sm:pt-32 sm:pb-40">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
          
          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 text-center lg:px-8">
            <Badge variant="outline" className="mb-6 rounded-full border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary shadow-sm backdrop-blur-sm">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              {t('home.brandTag')}
            </Badge>
            
            <h1 className="text-balance text-5xl font-extrabold tracking-tight sm:text-7xl">
              {t('home.heroTitleLine1')} <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">
                {t('home.heroTitleHighlight')}
              </span>
            </h1>
            
            <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
              {t('home.heroDescription')}
            </p>
            
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Button asChild size="lg" className="h-12 rounded-full px-8 text-base shadow-lg transition-transform hover:scale-105 text-black">
                <Link href="/login">
                  {t('home.cta')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* BENTO GRID FEATURES SECTION */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 border-t border-border/40 bg-muted/20">
          <div className="mb-16 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('home.featuresTitle')}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t('home.featuresDescription')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="bg-background shadow-none hover:border-primary/50 transition-colors duration-300">
              <CardHeader>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Briefcase className="h-5 w-5" />
                </div>
                <CardTitle>{t('home.recruitmentTitle')}</CardTitle>
                <CardDescription>
                  {t('home.recruitmentDescription')}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-background shadow-none hover:border-primary/50 transition-colors duration-300">
              <CardHeader>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <CardTitle>{t('home.tasksTitle')}</CardTitle>
                <CardDescription>
                  {t('home.tasksDescription')}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-background shadow-none hover:border-primary/50 transition-colors duration-300">
              <CardHeader>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <CardTitle>{t('home.rbacTitle')}</CardTitle>
                <CardDescription>
                  {t('home.rbacDescription')}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-background shadow-none hover:border-primary/50 transition-colors duration-300">
              <CardHeader>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <CardTitle>{t('home.feedTitle')}</CardTitle>
                <CardDescription>
                  {t('home.feedDescription')}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-background shadow-none hover:border-primary/50 transition-colors duration-300">
              <CardHeader>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <CardTitle>{t('home.eventsTitle')}</CardTitle>
                <CardDescription>
                  {t('home.eventsDescription')}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-background shadow-none hover:border-primary/50 transition-colors duration-300">
              <CardHeader>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <CardTitle>{t('home.notificationsTitle')}</CardTitle>
                <CardDescription>
                  {t('home.notificationsDescription')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-center lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:text-left">
          <div>
            <p className="text-sm leading-5 text-muted-foreground">
              &copy; {new Date().getFullYear()} NEI-ISEP. {t('home.footer')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-muted-foreground lg:justify-end">
            <Link href="/privacy" className="transition-colors hover:text-foreground">{t('home.privacy')}</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">{t('home.terms')}</Link>
            <span className="hidden h-4 w-px bg-border/60 lg:block" />
            <Select value={locale} onValueChange={handleLocaleChange}>
              <SelectTrigger className="h-8 w-[7.5rem] rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40 focus:ring-2 focus:ring-ring/30 data-[state=open]:bg-muted/40">
                <SelectValue placeholder={locale === 'pt' ? t('home.languagePortuguese') : t('home.languageEnglish')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">{t('home.languagePortuguese')}</SelectItem>
                <SelectItem value="en">{t('home.languageEnglish')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </footer>
    </div>
  );
}