'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  RefreshCw,
  Server,
  Shield,
  XCircle,
  Loader2,
  Zap,
} from 'lucide-react';

interface HealthData {
  postgres: { status: string; responseTime?: number };
}

interface ServiceStatus {
  name: string;
  status: string;
  responseTime?: number;
  url?: string;
}

interface SystemEvent {
  id: string;
  projectId?: string;
  level: string;
  module: string;
  message: string;
  ts: string;
  metaJson?: any;
}

export default function AdminPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async () => {
    try {
      const [h, svc, ev] = await Promise.allSettled([
        api.get<HealthData>('/system/health'),
        api.get<ServiceStatus[]>('/system/services'),
        api.get<any>('/system/events?take=50'),
      ]);

      if (h.status === 'fulfilled') setHealth(h.value);
      if (svc.status === 'fulfilled') setServices(Array.isArray(svc.value) ? svc.value : (svc.value as any)?.services || []);
      if (ev.status === 'fulfilled') setEvents(Array.isArray(ev.value) ? ev.value : (ev.value as any)?.data || []);
    } catch {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    toast.success('Данные обновлены');
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Доступ запрещён</h2>
            <p className="text-muted-foreground">
              Эта страница доступна только администраторам
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const levelVariant = (level: string): 'default' | 'secondary' | 'success' | 'warning' | 'error' => {
    switch (level) {
      case 'ERROR':
      case 'CRITICAL':
        return 'error';
      case 'WARNING':
        return 'warning';
      case 'INFO':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'ok' || status === 'healthy' || status === 'connected') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (status === 'degraded' || status === 'slow') {
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-brand-500" />
            Админ-панель
          </h1>
          <p className="text-muted-foreground">Мониторинг системы и сервисов</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Обновить
        </Button>
      </div>

      {/* Service Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* PostgreSQL */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">PostgreSQL</p>
                  <p className="text-xs text-muted-foreground">База данных</p>
                </div>
              </div>
              {health ? statusIcon(health.postgres.status) : <Skeleton className="h-5 w-5 rounded-full" />}
            </div>
            {health?.postgres.responseTime && (
              <p className="mt-2 text-xs text-muted-foreground">
                Время отклика: {health.postgres.responseTime}ms
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Services */}
        {services.map((svc) => (
          <Card key={svc.name}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {svc.name.toLowerCase().includes('n8n') ? (
                    <Zap className="h-8 w-8 text-orange-500" />
                  ) : svc.name.toLowerCase().includes('searxng') ? (
                    <Globe className="h-8 w-8 text-purple-500" />
                  ) : (
                    <Server className="h-8 w-8 text-gray-500" />
                  )}
                  <div>
                    <p className="font-medium">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">{svc.url || 'Сервис'}</p>
                  </div>
                </div>
                {statusIcon(svc.status)}
              </div>
              {svc.responseTime && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Время отклика: {svc.responseTime}ms
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Overall */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-brand-500" />
                <div>
                  <p className="font-medium">Система</p>
                  <p className="text-xs text-muted-foreground">Общий статус</p>
                </div>
              </div>
              <Badge variant="success">Работает</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events */}
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Системные события</TabsTrigger>
          <TabsTrigger value="errors">Только ошибки</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Последние события</CardTitle>
              <CardDescription>Все системные события и уведомления</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="py-12 text-center">
                  <Activity className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">Нет событий</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Уровень</TableHead>
                      <TableHead>Модуль</TableHead>
                      <TableHead>Сообщение</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge variant={levelVariant(event.level)}>{event.level}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{event.module}</TableCell>
                        <TableCell className="max-w-md truncate">{event.message}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {new Date(event.ts).toLocaleString('ru-RU')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ошибки и предупреждения</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const errors = events.filter(
                  (e) => e.level === 'ERROR' || e.level === 'CRITICAL' || e.level === 'WARNING',
                );
                if (errors.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-3" />
                      <p className="font-medium">Ошибок нет</p>
                      <p className="text-sm text-muted-foreground">Все системы работают нормально</p>
                    </div>
                  );
                }
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Уровень</TableHead>
                        <TableHead>Модуль</TableHead>
                        <TableHead>Сообщение</TableHead>
                        <TableHead>Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errors.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <Badge variant={levelVariant(event.level)}>{event.level}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{event.module}</TableCell>
                          <TableCell className="max-w-md truncate">{event.message}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {new Date(event.ts).toLocaleString('ru-RU')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
