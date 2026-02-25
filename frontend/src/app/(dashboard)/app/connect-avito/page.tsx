'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle, Shield, Zap } from 'lucide-react';
import { api } from '@/lib/api';

interface ProjectLite {
  id: string;
  name: string;
}

export default function ConnectAvitoPage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnectAvito = async () => {
    try {
      setIsConnecting(true);
      setError('');

      const { data: projects } = await api.get<ProjectLite[]>('/projects');
      const firstProjectId =
        Array.isArray(projects) && projects.length > 0 ? projects[0].id : null;

      if (!firstProjectId) {
        setError('Create a project first, then connect Avito account.');
        return;
      }

      const { data } = await api.get<{ url: string }>(
        `/avito/oauth/start?projectId=${firstProjectId}`,
      );

      if (!data?.url) {
        throw new Error('OAuth URL was not returned by backend');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || 'Failed to start Avito connection flow.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Connect Avito Account</h1>
        <p className="text-muted-foreground">
          Start secure OAuth authorization and link your Avito profile to this workspace.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Shield className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>Secure OAuth 2.0</CardTitle>
            <CardDescription>
              Account linking is processed via backend API with state validation.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <Zap className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>Ready for Automation</CardTitle>
            <CardDescription>
              After linking, your account is available for analytics, autoload, and bidding modules.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What happens next</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>You are redirected to Avito OAuth consent screen.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>Backend exchanges code and stores access and refresh tokens.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
              <span>You return to project Avito page with connection status.</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Start Connection</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            onClick={handleConnectAvito}
            disabled={isConnecting}
            size="lg"
            className="w-full sm:w-auto"
          >
            <ExternalLink className="mr-2 h-5 w-5" />
            {isConnecting ? 'Connecting...' : 'Connect Avito'}
          </Button>
          <Button
            onClick={() => router.push('/app/projects')}
            variant="outline"
            size="lg"
          >
            Open Projects
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
