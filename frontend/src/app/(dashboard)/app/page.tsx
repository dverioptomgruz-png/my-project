'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  FolderKanban,
  ShoppingBag,
  Gavel,
  Bell,
  Plus,
  Link2,
  ArrowRight,
  Activity,
} from 'lucide-react';
import type { Project, SystemEvent, AvitoAccount, BidderRule } from '@/types';

interface DashboardStats {
  projectsCount: number;
  activeAvitoAccounts: number;
  activeBidderRules: number;
  recentEventsCount: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    projectsCount: 0,
    activeAvitoAccounts: 0,
    activeBidderRules: 0,
    recentEventsCount: 0,
  });
  const [recentEvents, setRecentEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const [projectsRes, eventsRes] = await Promise.allSettled([
          api.get<Project[]>('/projects'),
          api.get<SystemEvent[]>('/system/events?take=5'),
        ]);

        let projectsCount = 0;
        if (projectsRes.status === 'fulfilled') {
          const projects = projectsRes.value.data;
          projectsCount = Array.isArray(projects) ? projects.length : 0;
        }

        let events: SystemEvent[] = [];
        let eventsCount = 0;
        if (eventsRes.status === 'fulfilled') {
          events = Array.isArray(eventsRes.value.data) ? eventsRes.value.data : [];
          eventsCount = events.length;
        }

        setStats({
          projectsCount,
          activeAvitoAccounts: 0,
          activeBidderRules: 0,
          recentEventsCount: eventsCount,
        });
        setRecentEvents(events);
      } catch (err) {
        toast.error({ title: 'Ошибка', description: 'Не удалось загрузить данные дашборда' });
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const eventTypeBadgeVariant = (eventType: SystemEvent['eventType']) => {
    switch (eventType) {
      case 'error':
      case 'critical':
        return 'error' as const;
      case 'warning':
        return 'warning' as const;
      case 'info':
      case 'sync_complete':
        return 'success' as const;
      default:
        return 'secondary' as const;
    }
  };

  const eventTypeLabel = (eventType: SystemEvent['eventType']) => {
    switch (eventType) {
      case 'info':
        return 'Инфо';
      case 'warning':
        return 'Предупреждение';
      case 'error':
        return 'Ошибка';
      case 'critical':
        return 'Критично';
      case 'bidder_update':
        return 'Биддер';
      case 'sync_complete':
        return 'Синхронизация';
      case 'account_issue':
        return 'Аккаунт';
      default:
        return eventType;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statsCards = [
    {
      title: 'Проекты',
      value: stats.projectsCount,
      description: 'Всего проектов',
      icon: FolderKanban,
      href: '/app/projects',
    },
    {
      title: 'Авито аккаунты',
      value: stats.activeAvitoAccounts,
      description: 'Активных подключений',
      icon: ShoppingBag,
      href: '/app/projects',
    },
    {
      title: 'Правила биддера',
      value: stats.activeBidderRules,
      description: 'Активных правил',
      icon: Gavel,
      href: '/app/projects',
    },
    {
      title: 'Недавние события',
      value: stats.recentEventsCount,
      description: 'За последнее время',
      icon: Bell,
      href: '#events',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Добро пожаловать{user?.fullName ? `, ${user.fullName}` : ''}
        </h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Обзор вашего рабочего пространства Нейро-Ассистент
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton height="16px" width="120px" />
                  <Skeleton height="20px" width="20px" />
                </CardHeader>
                <CardContent>
                  <Skeleton height="32px" width="60px" className="mb-1" />
                  <Skeleton height="14px" width="140px" />
                </CardContent>
              </Card>
            ))
          : statsCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href}>
                  <Card className="transition-shadow hover:shadow-md cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardDescription className="text-sm font-medium">
                        {card.title}
                      </CardDescription>
                      <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{card.value}</div>
                      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {card.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Быстрые действия
          </CardTitle>
          <CardDescription>
            Часто используемые операции для быстрого доступа
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/app/projects">
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Создать проект
              </Button>
            </Link>
            <Link href="/app/projects">
              <Button variant="outline" className="gap-2">
                <Link2 className="h-4 w-4" />
                Подключить Авито
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card id="events">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Последние события
          </CardTitle>
          <CardDescription>
            Недавняя активность в ваших проектах
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton height="20px" width="80px" />
                  <Skeleton height="16px" width="200px" />
                  <Skeleton height="14px" width="120px" className="ml-auto" />
                </div>
              ))}
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
              <p className="text-[hsl(var(--muted-foreground))]">
                Нет недавних событий
              </p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Здесь будут отображаться события из ваших проектов
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Заголовок</TableHead>
                  <TableHead>Сообщение</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead className="text-right">Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant={eventTypeBadgeVariant(event.eventType)}>
                        {eventTypeLabel(event.eventType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-[hsl(var(--muted-foreground))]">
                      {event.message}
                    </TableCell>
                    <TableCell className="text-[hsl(var(--muted-foreground))]">
                      {event.source}
                    </TableCell>
                    <TableCell className="text-right text-[hsl(var(--muted-foreground))]">
                      {formatDate(event.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
