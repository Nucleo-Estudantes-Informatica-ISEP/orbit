'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  FileText,
  FolderOpen,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Megaphone,
  CheckSquare,
  UserPlus,
  Package,
  ClipboardList,
  CreditCard,
  History,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth-context';
import { usePermission } from '@/lib/use-permission';
import { useLocale } from '@/lib/locale-context';
import { cn } from '@/lib/utils';
import { OrbitLogo } from '@/components/orbit-logo';

interface SidebarProps {
  userName?: string;
  userAvatar?: string;
  userInitials?: string;
}

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function DashboardSidebar({
  userName = 'John Doe',
  userAvatar,
  userInitials = 'JD',
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser, logout } = useAuth();
  const { t } = useLocale();
  const canSeeUsers = usePermission('USERS_VIEW');
  const canSeeRoles = usePermission('ROLES_VIEW');
  const canSeeDepartments = usePermission('DEPARTMENTS_VIEW');
  const canSeePeople = canSeeUsers || canSeeRoles || canSeeDepartments;
  const canSeeAnnouncements = usePermission('ANNOUNCEMENTS_VIEW');
  const canSeeEvents = usePermission('EVENTS_VIEW');
  const canSeeResources = usePermission('RESOURCES_VIEW');
  const canSeeProjects = usePermission('PROJECTS_VIEW');
  const canSeeTasks = usePermission('TASKS_VIEW');
  const canSeeRecruitment = usePermission('RECRUITMENT_VIEW');
  const canSeeInventory = usePermission('INVENTORY_VIEW');
  const canSeePlans = usePermission('PLANS_VIEW');
  const canSeeDebts = usePermission('DEBTS_VIEW');
  const canSeeAudits = authUser?.permissions?.includes('AUDITS_READ') ?? false;
  const canSeeIncidents = usePermission('INCIDENTS_VIEW');
  const canSeeFiles = usePermission('FILES_VIEW');

  const navItems = (...items: Array<NavItem | null>): NavItem[] => items.filter((item): item is NavItem => Boolean(item));

  const navGroups: NavGroup[] = [
    {
      label: t('nav.general'),
      items: navItems(
        { icon: LayoutDashboard, label: t('nav.dashboard'), href: '/dashboard' },
        canSeePeople ? { icon: Users, label: t('nav.people'), href: '/dashboard/people' } : null,
      ),
    },
    {
      label: t('nav.content'),
      items: navItems(
        canSeeAnnouncements ? { icon: Megaphone, label: t('nav.communications'), href: '/dashboard/announcements' } : null,
        canSeeEvents ? { icon: Calendar, label: t('nav.events'), href: '/dashboard/events' } : null,
        canSeeResources ? { icon: FolderOpen, label: t('nav.resources'), href: '/dashboard/documents' } : null,
      ),
    },
    {
      label: t('nav.operations'),
      items: navItems(
        canSeeProjects ? { icon: Briefcase, label: t('nav.projects'), href: '/dashboard/projects' } : null,
        canSeeTasks ? { icon: CheckSquare, label: t('nav.tasks'), href: '/dashboard/tasks' } : null,
        canSeeRecruitment ? { icon: UserPlus, label: t('nav.recruitment'), href: '/dashboard/recruitment' } : null,
      ),
    },
    {
      label: t('nav.management'),
      items: navItems(
        canSeeInventory ? { icon: Package, label: t('nav.inventory'), href: '/dashboard/inventory' } : null,
        canSeePlans ? { icon: ClipboardList, label: t('nav.plans'), href: '/dashboard/plans' } : null,
        canSeeDebts ? { icon: CreditCard, label: t('nav.debts'), href: '/dashboard/debts' } : null,
        canSeeIncidents ? { icon: AlertTriangle, label: t('nav.incidents'), href: '/dashboard/incidents' } : null,
      ),
    },
    {
      label: t('nav.system'),
      items: navItems(
        canSeeAudits ? { icon: History, label: t('nav.auditLogs'), href: '/dashboard/audit-logs' } : null,
        canSeeFiles ? { icon: FileText, label: t('nav.files'), href: '/dashboard/files' } : null,
      ),
    },
  ].filter((group) => group.items.length > 0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsMobileMenuOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="flex md:hidden h-16 items-center justify-between px-4 border-b border-border/40 bg-background shrink-0">
        <div className="flex items-center gap-2">
          <OrbitLogo />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Backdrop Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-background text-foreground transition-transform duration-300 ease-in-out border-r border-border/40',
          'md:relative md:translate-x-0',
          isCollapsed ? 'md:w-20' : 'md:w-80',
          isMobileMenuOpen ? 'translate-x-0 w-72 shadow-2xl md:shadow-none' : '-translate-x-full w-72 md:w-auto',
        )}
      >
        {/* Header */}
        <div className={cn('flex shrink-0 border-b border-border/40', isCollapsed ? 'md:flex-col md:items-center md:py-4 md:gap-2' : 'items-center justify-between p-4 h-16')}>
          {/* Logo */}
          <div className="flex items-center">
            {isCollapsed ? (
              <Image
                src="/favicon.svg"
                alt="ORBIT"
                width={32}
                height={32}
                className="hidden h-8 w-8 md:block"
              />
            ) : (
              <>
                <OrbitLogo />
              </>
            )}
          </div>

          {/* Desktop: collapse toggle */}
          <div className="hidden md:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {/* Mobile: close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Separator className="bg-border/40" />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-4 py-3">
            {navGroups.map((group) => (
              <div key={group.label}>
                {!isCollapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-1.5">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        isActive(item.href)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        isCollapsed && 'md:justify-center',
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={cn(isCollapsed ? 'md:hidden' : 'block')}>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Separator className="bg-border/40" />

        {/* User Profile Section */}
        <div className="p-3 shrink-0 space-y-1">
          {/* Settings link */}
          <Link
            href="/dashboard/settings"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive('/dashboard/settings')
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              isCollapsed && 'md:justify-center',
            )}
            title={isCollapsed ? t('nav.settings') : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className={cn(isCollapsed ? 'md:hidden' : 'block')}>{t('nav.settings')}</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 h-auto px-3 py-2 text-foreground hover:bg-muted',
                  isCollapsed && 'md:flex-col md:px-0 md:justify-center',
                )}
              >
                <Avatar className="h-8 w-8 border border-border/40 shrink-0">
                  {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('flex flex-col text-left overflow-hidden', isCollapsed ? 'md:hidden' : 'block')}>
                  <span className="text-sm font-semibold leading-tight truncate">{userName}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={isMobileMenuOpen ? 'bottom' : (isCollapsed ? 'right' : 'bottom')} align={isMobileMenuOpen ? 'start' : (isCollapsed ? 'end' : 'start')} className="w-56 mb-1" sideOffset={8}>
              <div className="px-2 py-1.5 text-sm">
                <p className="font-semibold">{userName}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  {t('nav.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('nav.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}
