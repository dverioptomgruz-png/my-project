'use client';

import Link from 'next/link';
import { PricingSection } from '@/components/pricing-section';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  BarChart3,
  Bot,
  LineChart,
  MessageSquare,
  Search,
  Shield,
  Star,
  TrendingUp,
  Zap,
    Link2,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: TrendingUp,
    title: 'Биддер ставок',
    desc: 'Автоматическое управление ставками для удержания позиций в выдаче Авито',
  },
  {
    icon: Zap,
    title: 'Автозагрузка',
    desc: 'Мониторинг и контроль выгрузки объявлений. Ошибки выявляются мгновенно',
  },
  {
    icon: MessageSquare,
    title: 'AI-Автоответчик',
    desc: 'Нейросеть отвечает на сообщения покупателей 24/7, не теряя ни одного лида',
  },
  {
    icon: Search,
    title: 'Анализ конкурентов',
    desc: 'Парсинг выдачи и мониторинг позиций конкурентов через SearXNG',
  },
  {
    icon: BarChart3,
    title: 'Сквозная аналитика',
    desc: 'ROI, ROMI, CPL — все метрики в одном дашборде с экспортом в CSV',
  },
  {
    icon: Star,
    title: 'Отзывы + AI',
    desc: 'AI генерирует ответы на отзывы, вы утверждаете и публикуете в один клик',
  },
    {
    icon: Link2,
    title: 'CRM Интеграция',
    desc: 'Авто-создание сделок и синхронизация с amoCRM, Bitrix24',
  },
    {
    icon: FlaskConical,
    title: 'A/B-Тестировщик',
    desc: 'AI автоматически тестирует гипотезы, выкладывает объявления и анализирует просмотры',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white font-bold text-sm">
              НА
            </div>
            <span className="text-lg font-semibold">Нейро-Ассистент</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Войти</Button>
            </Link>
            <Link href="/auth/register">
              <Button size="sm">Начать бесплатно</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            Анализ результатов, детальные отчёты и Платформа на базе ИИ и автоматизацииИИ и автоматизациявизуализация метрик
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Автоматизируйте{' '}
            <span className="text-brand-500">Авито</span>
            <br />с помощью нейросетей
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Управляйте ставками, отвечайте на сообщения, анализируйте конкурентов
            и отслеживайте метрики — всё в одном дашборде. Подключите аккаунт Авито
            за 2 минуты и начните экономить время.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register">
              <Button size="lg" className="text-base px-8">
                Попробовать бесплатно
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg" className="text-base px-8">
                У меня есть аккаунт
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Модули платформы</h2>
          <p className="mt-3 text-muted-foreground">
            Каждый модуль решает конкретную задачу и работает автономно через n8n
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                  <f.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold mb-12">Как это работает</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { step: '1', title: 'Подключите аккаунт', desc: 'OAuth2 авторизация — безопасно и за 30 секунд' },
              { step: '2', title: 'Настройте модули', desc: 'Выберите стратегии ставок, шаблоны ответов, фильтры' },
              { step: '3', title: 'Получайте результат', desc: 'Анализ результатов, детальные отчёты и визуализация метрик' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-white text-lg font-bold">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl text-center px-4">
          <Shield className="mx-auto h-10 w-10 text-brand-500 mb-4" />
          <h2 className="text-3xl font-bold">Безопасность данных</h2>
          <p className="mt-4 text-muted-foreground">
            Токены Авито хранятся с AES-256-GCM шифрованием. Мы никогда не передаём
            ваши токены на фронтенд. Self-hosted решение — ваши данные остаются у вас.
          </p>
          <Link href="/auth/register" className="mt-8 inline-block">
            <Button size="lg">Начать работу</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <PricingSection />

            {/* Partners Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Наши партнёры
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Мы сотрудничаем с лучшими экспертами в области маркетинга и автоматизации бизнеса
          </p>
          
          <div className="flex justify-center">
            <a 
              href="https://t.me/pozeminamarketolog" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-8 hover:shadow-xl transition-all duration-300 max-w-md w-full"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    Telegram-канал Поземиной
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Экспертные статьи по маркетингу и продвижению бизнеса. Полезные инструменты и кейсы для продавцов на Авито.
                  </p>
                  <div className="flex items-center text-sm text-primary">
                    <span className="font-medium">Перейти в канал</span>
                    <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>Нейро-Ассистент &copy; {new Date().getFullYear()}</span>
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4" />
            <span>Powered by n8n + AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
