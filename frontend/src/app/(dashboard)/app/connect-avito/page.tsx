'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle, Shield, Zap } from 'lucide-react';

export default function ConnectAvitoPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnectAvito = async () => {
    try {
      setIsConnecting(true);
      setError('');
      
      const clientId = process.env.NEXT_PUBLIC_AVITO_CLIENT_ID;
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/api/auth/avito/callback`
      );
      const scope = 'autoload:reports,items:apply,user:read';
      const state = crypto.randomUUID();

      sessionStorage.setItem('avito_oauth_state', state);

      const avitoAuthUrl = `https://www.avito.ru/oauth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

      window.location.href = avitoAuthUrl;
    } catch (err) {
      setError('Ошибка при подключении Авито. Попробуйте ещё раз.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Подключение Авито</h1>
        <p className="text-muted-foreground">
          Подключите ваш аккаунт Авито для начала автоматизации
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-500 bg-red-50 dark:bg-red-950 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <Shield className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Безопасное подключение</CardTitle>
            <CardDescription>
              Используем OAuth 2.0 для защищённого доступа
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <Zap className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Автоматизация</CardTitle>
            <CardDescription>
              Автоматическая синхронизация данных
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Что произойдёт после подключения?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Просматривать статистику объявлений</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Управлять сообщениями через AI-ассистента</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Автоматически продвигать объявления</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 text-green-600 flex-shrink-0" />
              <span>Отслеживать баланс и операции</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Готовы начать?</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleConnectAvito}
            disabled={isConnecting}
            size="lg"
            className="w-full sm:w-auto"
          >
            <ExternalLink className="mr-2 h-5 w-5" />
            {isConnecting ? 'Подключение...' : 'Подключить Авито'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}