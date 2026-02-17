'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

interface AvitoAccount {
  id: string;
  account_name: string;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
}

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AvitoAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<{ plan: string; max_accounts: number } | null>(null);

  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchSubscription();
    }
  }, [user]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscription');
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const canAddAccount = () => {
    if (!subscription) return false;
    if (subscription.max_accounts === -1) return true; // unlimited
    return accounts.length < subscription.max_accounts;
  };

  const getAccountLimit = () => {
    if (!subscription) return 'Загрузка...';
    if (subscription.max_accounts === -1) return 'Безлимит';
    return `${accounts.length} / ${subscription.max_accounts}`;
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Аккаунты Авито</h1>
          <p className="text-muted-foreground mt-1">
            Управляйте подключенными аккаунтами • {getAccountLimit()}
          </p>
        </div>
        <Button asChild disabled={!canAddAccount()}>
          <Link href="/app/connect-avito">
            <Plus className="mr-2 h-4 w-4" />
            Подключить аккаунт
          </Link>
        </Button>
      </div>

      {!canAddAccount() && accounts.length > 0 && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium">Достигнут лимит аккаунтов</p>
              <p className="text-sm text-muted-foreground">
                Для подключения большего количества аккаунтов обновите тариф
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" asChild>
              <Link href="/pricing">Улучшить тариф</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {accounts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Нет подключенных аккаунтов</h3>
            <p className="text-muted-foreground mb-4">
              Подключите ваш первый аккаунт Авито для начала работы
            </p>
            <Button asChild>
              <Link href="/app/connect-avito">
                <Plus className="mr-2 h-4 w-4" />
                Подключить Авито
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className={!account.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{account.account_name}</CardTitle>
                    <CardDescription>
                      Подключен {formatDate(account.created_at)}
                    </CardDescription>
                  </div>
                  <Badge variant={account.is_active ? 'default' : 'secondary'}>
                    {account.is_active ? 'Активен' : 'Отключен'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isTokenExpired(account.token_expires_at) && (
                  <div className="flex items-center gap-2 text-yellow-500 text-sm mb-3">
                    <AlertCircle className="h-4 w-4" />
                    <span>Требуется переподключение</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Обновить
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
