'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Bot,
  FolderOpen,
  Gauge,
  LineChart,
  MessageSquare,
  Search,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Upload,
  Filter,
  FlaskConical,
} from 'lucide-react';

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname();

  const mainLinks = [
    { href: '/app', label: 'Дашборд', icon: Gauge },
    { href: '/app/projects', label: 'Проекты', icon: FolderOpen },
  ];

  const moduleLinks = projectId
    ? [
        { href: `/app/projects/${projectId}/bidder`, label: 'Биддер ставок', icon: TrendingUp },
        { href: `/app/projects/${projectId}/autoload`, label: 'Автозагрузка', icon: Upload },
        { href: `/app/projects/${projectId}/chat`, label: 'Чаты / AI', icon: MessageSquare },
        { href: `/app/projects/${projectId}/competitors`, label: 'Конкуренты', icon: Search },
        { href: `/app/projects/${projectId}/analytics`, label: 'Аналитика', icon: BarChart3 },
        { href: `/app/projects/${projectId}/reviews`, label: 'Отзывы', icon: Star },
        { href: `/app/projects/${projectId}/funnel`, label: 'Воронка', icon: Filter },
        { href: `/app/projects/${projectId}/avito`, label: 'Авито OAuth', icon: LineChart },
        { href: `/app/projects/${projectId}/settings`, label: 'Настройки', icon: Settings },
      ]
    : [];

  if (projectId) {
    moduleLinks.push({
      href: `/app/projects/${projectId}/ab-tester`,
      label: 'A/B Tester',
      icon: FlaskConical,
    });
  }

  const adminLinks = [
    { href: '/app/admin', label: 'Админ-панель', icon: Shield },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white font-bold text-sm">
          НА
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">Нейро-Ассистент</span>
          <span className="text-[10px] text-muted-foreground">Автоматизация Авито</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Main Navigation */}
        <div>
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Навигация
          </p>
          <div className="space-y-1">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Module Links - only show when project is selected */}
        {moduleLinks.length > 0 && (
          <div>
            <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Модули проекта
            </p>
            <div className="space-y-1">
              {moduleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                    pathname === link.href || pathname.startsWith(link.href + '/')
                      ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Admin */}
        <div>
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Система
          </p>
          <div className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom branding */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
          <span>Powered by n8n + AI</span>
        </div>
      </div>
    </aside>
  );
}
