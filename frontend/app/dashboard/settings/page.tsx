'use client';

import { useState, useEffect } from 'react';
import { User, Bell, Palette, Lock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useLocale, type AppLocale } from '@/lib/locale-context';

interface UserSettings {
  id?: string;
  userId: string;
  darkMode: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  language: string;
}

type ToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    const timeoutId = window.setTimeout(() => {
      setProfileForm({ name: user.name, email: user.email });
      setLoadingSettings(true);
      api.get<UserSettings>(`/user-settings/${user.id}`)
        .then((settings) => setSettings(settings))
        .catch(() => {
          // 404 or error — use defaults; creates on first save via upsert
          setSettings({ userId: user.id, darkMode: false, emailNotifications: true, inAppNotifications: true, language: locale });
        })
        .finally(() => setLoadingSettings(false));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [locale, user]);

  const handleSaveProfile = async () => {
    if (!user || !profileForm.name.trim()) return;
    setProfileSaving(true); setProfileMsg('');
    try {
      await api.put(`/users/${user.id}`, { name: profileForm.name });
      setProfileMsg(t('settings.profileSaved'));
    } catch (error: unknown) { setProfileMsg(error instanceof Error ? error.message : t('settings.profileSaveError')); }
    setProfileSaving(false);
  };

  const handleSaveSettings = async () => {
    if (!settings || !user) return;
    setSettingsSaving(true); setSettingsMsg('');
    try {
      await api.put(`/user-settings/${user.id}`, settings);
      setSettingsMsg(t('settings.preferencesSaved'));
    } catch (error: unknown) { setSettingsMsg(error instanceof Error ? error.message : t('settings.profileSaveError')); }
    setSettingsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.next || passwordForm.next !== passwordForm.confirm) {
      setPasswordMsg(t('settings.passwordMismatch')); return;
    }
    if (passwordForm.next.length < 6) { setPasswordMsg(t('settings.passwordLength')); return; }
    setPasswordMsg('');
    try {
      await api.put(`/users/${user?.id}`, { password: passwordForm.next });
      setPasswordForm({ current: '', next: '', confirm: '' });
      setPasswordMsg(t('settings.passwordSuccess'));
    } catch (error: unknown) { setPasswordMsg(error instanceof Error ? error.message : t('settings.passwordError')); }
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';
  const roleLabel = user?.roles?.[0] ?? t('common.member');

  const handleLanguageChange = async (next: AppLocale) => {
    if (!settings) return;
    const updated = { ...settings, language: next };
    setSettings(updated);
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      await api.put(`/user-settings/${user?.id}`, updated);
      await setLocale(next, false);
      setSettingsMsg(t('settings.preferencesSaved'));
    } catch (error: unknown) {
      setSettingsMsg(error instanceof Error ? error.message : t('settings.profileSaveError'));
    }
    setSettingsSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile"><User className="mr-1.5 h-3.5 w-3.5" />{t('settings.profileTab')}</TabsTrigger>
          <TabsTrigger value="preferences"><Palette className="mr-1.5 h-3.5 w-3.5" />{t('settings.appearanceTab')}</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" />{t('settings.notificationsTab')}</TabsTrigger>
          <TabsTrigger value="security"><Lock className="mr-1.5 h-3.5 w-3.5" />{t('settings.securityTab')}</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6 space-y-4">
          <Card className="border-border/40">
            <CardHeader><CardTitle>{t('settings.profileInfo')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-border/40">
                  <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{roleLabel}</p>
                </div>
              </div>
              <Separator className="bg-border/40" />
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t('settings.name')}</Label>
                  <Input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('settings.email')}</Label>
                  <Input value={profileForm.email} disabled className="opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-muted-foreground">{t('settings.emailHelp')}</p>
                </div>
              </div>
              {profileMsg && (
                <p className={`text-sm ${profileMsg === t('settings.profileSaved') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{profileMsg}</p>
              )}
              <Button onClick={handleSaveProfile} disabled={profileSaving}>{profileSaving ? t('settings.saving') : t('settings.saveChanges')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="mt-6">
          <Card className="border-border/40">
            <CardHeader><CardTitle>{t('settings.appearance')}</CardTitle><CardDescription>{t('settings.appearanceDescription')}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {loadingSettings ? <Skeleton className="h-24 w-full" /> : settings && (
                <>
                  <div className="space-y-1.5">
                    <Label>{t('settings.language')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
                    <div className="flex gap-2">
                      <Button variant={settings.language === 'pt' ? 'default' : 'outline'} size="sm" disabled={settingsSaving} onClick={() => void handleLanguageChange('pt')} className="cursor-pointer">{t('settings.languagePortuguese')}</Button>
                      <Button variant={settings.language === 'en' ? 'default' : 'outline'} size="sm" disabled={settingsSaving} onClick={() => void handleLanguageChange('en')} className="cursor-pointer">{t('settings.languageEnglish')}</Button>
                    </div>
                  </div>
                  {settingsMsg && <p className={`text-sm ${settingsMsg === t('settings.preferencesSaved') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{settingsMsg}</p>}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-6">
          <Card className="border-border/40">
            <CardHeader><CardTitle>{t('settings.notifications')}</CardTitle><CardDescription>{t('settings.notificationsDescription')}</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {loadingSettings ? <Skeleton className="h-24 w-full" /> : settings && (
                <>
                  <ToggleRow
                    label={t('settings.inAppNotifications')}
                    description={t('settings.inAppNotificationsDescription')}
                    checked={settings.inAppNotifications}
                    onChange={(v) => setSettings((p) => p ? { ...p, inAppNotifications: v } : p)}
                  />
                  <Separator className="bg-border/40" />
                  <ToggleRow
                    label={t('settings.emailNotifications')}
                    description={t('settings.emailNotificationsDescription')}
                    checked={settings.emailNotifications}
                    onChange={(v) => setSettings((p) => p ? { ...p, emailNotifications: v } : p)}
                  />
                  <div className="pt-2">
                    {settingsMsg && <p className={`text-sm mb-2 ${settingsMsg === t('settings.preferencesSaved') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{settingsMsg}</p>}
                    <Button onClick={handleSaveSettings} disabled={settingsSaving}>{settingsSaving ? t('settings.saving') : t('settings.preferencesSave')}</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6">
          <Card className="border-border/40">
            <CardHeader><CardTitle>{t('settings.security')}</CardTitle><CardDescription>{t('settings.securityDescription')}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('settings.currentPassword')}</Label>
                <Input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.newPassword')}</Label>
                <Input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings.confirmPassword')}</Label>
                <Input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))} />
              </div>
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg === t('settings.passwordSuccess') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{passwordMsg}</p>
              )}
              <Button onClick={handleChangePassword}>{t('settings.changePassword')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
