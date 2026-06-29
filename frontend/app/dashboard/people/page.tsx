'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Building2, Shield, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { useLocale } from '@/lib/locale-context';
import { usePermission } from '@/lib/use-permission';

const UsersTab = dynamic(() => import('./components/users-tab'), {
  ssr: false,
  loading: () => <TabLoadingState />,
});

const RolesTab = dynamic(() => import('./components/roles-tab'), {
  ssr: false,
  loading: () => <TabLoadingState />,
});

const DepartmentsTab = dynamic(() => import('./components/departments-tab'), {
  ssr: false,
  loading: () => <TabLoadingState />,
});

type PeopleTab = 'users' | 'roles' | 'departments';

type PeopleSection = {
  id: PeopleTab;
  label: string;
  icon: typeof Users;
  permission: string;
  panel: React.ReactNode;
};

function TabLoadingState() {
  return (
    <Card className="bg-background shadow-sm border-border/40">
      <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading section...
      </CardContent>
    </Card>
  );
}

export default function PeoplePage() {
  const { t } = useLocale();
  const canViewUsers = usePermission('USERS_VIEW');
  const canViewRoles = usePermission('ROLES_VIEW');
  const canViewDepartments = usePermission('DEPARTMENTS_VIEW');
  const [activeTab, setActiveTab] = useState<PeopleTab>('users');

  const sections = useMemo<PeopleSection[]>(() => {
    const items: PeopleSection[] = [];

    if (canViewUsers) {
      items.push({ id: 'users', label: t('people.users'), icon: Users, permission: 'USERS_READ', panel: <UsersTab /> });
    }

    if (canViewRoles) {
      items.push({ id: 'roles', label: t('people.roles'), icon: Shield, permission: 'ROLES_READ', panel: <RolesTab /> });
    }

    if (canViewDepartments) {
      items.push({ id: 'departments', label: t('people.departments'), icon: Building2, permission: 'DEPARTMENTS_READ', panel: <DepartmentsTab /> });
    }

    return items;
  }, [canViewUsers, canViewRoles, canViewDepartments, t]);

  useEffect(() => {
    if (sections.length === 0) return;
    if (!sections.some((section) => section.id === activeTab)) {
      setActiveTab(sections[0].id);
    }
  }, [activeTab, sections]);

  const activePanel = useMemo(() => sections.find((section) => section.id === activeTab)?.panel ?? null, [activeTab, sections]);

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t('people.title')}</h1>
        <p className="mt-1 md:mt-2 text-base text-muted-foreground">
          {t('people.subtitle')}
        </p>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={t('people.noAccessTitle')}
          description={t('people.noAccessDescription')}
        />
      ) : (
        <>
          {/* Alterado para permitir scroll horizontal no mobile sem quebrar o layout */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PeopleTab)} className="w-full">
            <div className="w-full overflow-x-auto pb-2">
              <TabsList className="flex w-max min-w-full justify-start bg-muted/70 p-1 sm:justify-center md:w-auto md:min-w-0">
                {sections.map((section) => (
                  <TabsTrigger key={section.id} value={section.id} className="gap-2 shrink-0">
                    <section.icon className="h-4 w-4" />
                    {section.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <div>{activePanel}</div>
        </>
      )}
    </div>
  );
}