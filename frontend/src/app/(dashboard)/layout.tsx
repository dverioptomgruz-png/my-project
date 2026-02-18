'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <div style={{color:'white',padding:'40px'}}>Loading dashboard...</div>;
  }

  if (!user) {
    return <div style={{color:'white',padding:'40px'}}>Redirecting to login...</div>;
  }

  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <nav style={{width:'200px',background:'#1a1a2e',color:'white',padding:'20px'}}>
        <h3>Dashboard</h3>
        <a href="/app/projects" style={{color:'#4ade80',display:'block',marginTop:'10px'}}>Projects</a>
      </nav>
      <main style={{flex:1,padding:'20px'}}>
        {children}
      </main>
    </div>
  );
}
