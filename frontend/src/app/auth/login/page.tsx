'use client';

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/app');
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Нейро-Ассистент</h1>
          <p className="text-muted-foreground">Автоматизация Авито</p>
        </div>
        
        <div className="rounded-xl border bg-card p-8 shadow-lg">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary))',
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button',
                input: 'auth-input',
              },
            }}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Эл. почта',
                  password_label: 'Пароль',
                  button_label: 'Войти',
                  loading_button_label: 'Вход...',
                  link_text: 'Уже есть аккаунт? Войти',
                },
                sign_up: {
                  email_label: 'Эл. почта',
                  password_label: 'Пароль',
                  button_label: 'Создать аккаунт',
                  loading_button_label: 'Создание...',
                  link_text: 'Нет аккаунта? Зарегистрироваться',
                },
                            forgotten_password: {
              link_text: 'Забыли пароль?',
            },
              },
            }}
            providers={[]}
            redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/app`}
          />
        </div>
      </div>
    </div>
  );
}