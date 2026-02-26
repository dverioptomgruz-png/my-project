'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { api } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [projectName, setProjectName] = useState<string | undefined>(undefined);

  const projectId = useMemo(() => {
    const match = pathname.match(/^\/app\/projects\/([^/]+)/);
    return match?.[1];
  }, [pathname]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    let cancelled = false;

    if (!projectId || !user) {
      setProjectName(undefined);
      return;
    }

    api
      .get<{ name?: string }>(`/projects/${projectId}`)
      .then(({ data }) => {
        if (!cancelled) {
          setProjectName(data?.name || undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectName(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  if (isLoading) {
    return <div style={{ color: 'white', padding: '40px' }}>Loading dashboard...</div>;
  }

  if (!user) {
    return <div style={{ color: 'white', padding: '40px' }}>Redirecting to login...</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar projectName={projectName} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
