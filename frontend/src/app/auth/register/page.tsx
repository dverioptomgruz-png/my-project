'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
      router.push('/app');
    } catch (err: any) {
      setError(err.message || 'Registration error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Нейро-Ассистент</h1>
          <p className="text-muted-foreground mt-2">Создание аккаунта</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Имя</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя" className="auth-input w-full px-3 py-2 rounded-md border border-border bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Эл. почта</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" className="auth-input w-full px-3 py-2 rounded-md border border-border bg-background" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="auth-input w-full px-3 py-2 rounded-md border border-border bg-background" required />
          </div>
          <button type="submit" disabled={loading} className="auth-button w-full py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
            {loading ? 'Создание...' : 'Создать аккаунт'}
          </button>
        </form>
        {error && <div className="text-red-500 text-center text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">{error}</div>}
        <div className="text-center">
          <Link href="/auth/login" className="text-primary text-sm hover:underline">Уже есть аккаунт? Войти</Link>
        </div>
      </div>
    </div>
  );
}
