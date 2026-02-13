'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingBag,
  LinkIcon,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AvitoAccount } from '@/types';

interface AvitoStatus {
  accounts: AvitoAccountWithStatus[];
}

interface AvitoAccountWithStatus extends AvitoAccount {
  status?: 'ACTIVE' | 'EXPIRED' | 'DISCONNECTED';
}

const STATUS_CONFIG = {
  ACTIVE: {
    label: 'Активен',
    variant: 'success' as const,
    icon: CheckCircle2,
    description: 'Аккаунт подключен и работает',
  },
  EXPIRED: {
    label: 'Истек',
    variant: 'warning' as const,
    icon: AlertCircle,
    description: 'Токен доступа истек, необходимо переподключение',
  },
  DISCONNECTED: {
    label: 'Отключен',
    variant: 'error' as const,
    icon: XCircle,
    description: 'Аккаунт отключен от системы',
  },
};

export default function AvitoConnectionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  const [accounts, setAccounts] = useState<AvitoAccountWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AvitoStatus | AvitoAccountWithStatus[]>(
        `/avito/status?projectId=${projectId}`
      );

      let accountsList: AvitoAccountWithStatus[];
      if (Array.isArray(data)) {
        accountsList = data;
      } else if (data && typeof data === 'object' && 'accounts' in data) {
        accountsList = Array.isArray(data.accounts) ? data.accounts : [];
      } else {
        accountsList = [];
      }

      // Derive status from account fields if not provided by API
      accountsList = accountsList.map((acc) => {
        if (!acc.status) {
          let derivedStatus: 'ACTIVE' | 'EXPIRED' | 'DISCONNECTED' = 'DISCONNECTED';
          if (acc.isActive && acc.tokenExpiresAt) {
            const expiresAt = new Date(acc.tokenExpiresAt);
            derivedStatus = expiresAt > new Date() ? 'ACTIVE' : 'EXPIRED';
          } else if (acc.isActive) {
            derivedStatus = 'ACTIVE';
          }
          return { ...acc, status: derivedStatus };
        }
        return acc;
      });

      setAccounts(accountsList);
    } catch {
      toast.error({ title: 'Ошибка', description: 'Не удалось загрузить статус Авито' });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle ?connected=true callback
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success({
        title: 'Авито подключен',
        description: 'Аккаунт Авито успешно подключен к проекту',
      });
      // Refresh the accounts list after connection
      fetchStatus();
      // Clean the URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('connected');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams, fetchStatus]);

  const handleConnect = () => {
    setConnecting(true);
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    window.location.href = `${apiBaseUrl}/avito/oauth/start?projectId=${projectId}`;
  };

  const handleRefresh = async (accountId: string) => {
    setRefreshingId(accountId);
    try {
      await api.post(`/avito/refresh`, { accountId });
      toast.success({ title: 'Успех', description: 'Токен доступа обновлен' });
      await fetchStatus();
    } catch (err: any) {
      toast.error({
        title: 'Ошибка обновления',
        description: err?.message || 'Не удалось обновить токен',
      });
    } finally {
      setRefreshingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Нет данных';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeCount = accounts.filter((a) => a.status === 'ACTIVE').length;
  const expiredCount = accounts.filter((a) => a.status === 'EXPIRED').length;
  const disconnectedCount = accounts.filter((a) => a.status === 'DISCONNECTED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Авито подключения</h1>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">
            Управление аккаунтами Авито для этого проекта
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting} className="gap-2">
          <LinkIcon className="h-4 w-4" />
          {connecting ? 'Переход...' : 'Подключить Авито'}
        </Button>
      </div>

      {/* Status Summary */}
      {!loading && accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Активных</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredCount}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Истекших</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{disconnectedCount}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Отключенных</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account Cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton height="20px" width="160px" />
                  <Skeleton height="22px" width="80px" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton height="14px" width="200px" />
                <Skeleton height="14px" width="180px" />
                <Skeleton height="14px" width="160px" />
              </CardContent>
              <CardFooter>
                <Skeleton height="36px" width="100%" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <ShoppingBag className="mb-4 h-16 w-16 text-[hsl(var(--muted-foreground))]" />
          <h2 className="text-xl font-semibold">Нет подключенных аккаунтов</h2>
          <p className="mt-2 max-w-md text-center text-[hsl(var(--muted-foreground))]">
            Подключите ваш аккаунт Авито, чтобы начать управлять объявлениями, биддером
            и аналитикой прямо из дашборда.
          </p>
          <Button onClick={handleConnect} disabled={connecting} className="mt-6 gap-2">
            <LinkIcon className="h-4 w-4" />
            {connecting ? 'Переход...' : 'Подключить первый аккаунт'}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const statusKey = account.status || 'DISCONNECTED';
            const config = STATUS_CONFIG[statusKey];
            const StatusIcon = config.icon;
            const isRefreshing = refreshingId === account.id;

            return (
              <Card key={account.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary))]" />
                      <CardTitle className="text-base">{account.name}</CardTitle>
                    </div>
                    <Badge variant={config.variant} className="gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <CardDescription>{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">Client ID:</span>
                      <span className="font-mono text-xs">
                        {account.clientId
                          ? `${account.clientId.substring(0, 8)}...`
                          : 'Не указан'}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">Последняя синхронизация:</span>
                      <span>{formatDate(account.lastSyncAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">Токен истекает:</span>
                      <span>{formatDate(account.tokenExpiresAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--muted-foreground))]">Дата подключения:</span>
                      <span>{formatDate(account.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="gap-2">
                  {(statusKey === 'EXPIRED' || statusKey === 'DISCONNECTED') && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => handleRefresh(account.id)}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Обновление...' : 'Переподключить'}
                    </Button>
                  )}
                  {statusKey === 'ACTIVE' && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => handleRefresh(account.id)}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Обновление...' : 'Обновить токен'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
