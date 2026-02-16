'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function ConnectAvitoPage() {
  const handleConnectAvito = () => {
    const clientId = process.env.NEXT_PUBLIC_AVITO_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/api/auth/avito/callback`
    );
    const scope = 'autoload:reports,items:apply_vas,items:info,job:cv,job:resumes,job:write,messenger:read,messenger:write,ratings:read,short_term_rent:read,short_term_rent:write,stats:read,user:read,user_balance:read,user_operations:read';
    const state = crypto.randomUUID();
    
    // Store state in sessionStorage for verification
    sessionStorage.setItem('avito_oauth_state', state);
    
    const avitoAuthUrl = `https://www.avito.ru/oauth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    
    window.location.href = avitoAuthUrl;
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img src="/avito-logo.svg" alt="Avito" className="h-8 w-8" />
            Подключение Авито
          </CardTitle>
          <CardDescription>
            Подключите ваш аккаунт Авито для автоматизации управления объявлениями
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>После подключения вы сможете:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Просматривать статистику объявлений</li>
              <li>Управлять сообщениями</li>
              <li>Автоматически продвигать объявления</li>
              <li>Отслеживать баланс и операции</li>
            </ul>
          </div>
          <Button onClick={handleConnectAvito} className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            Подключить Авито
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}