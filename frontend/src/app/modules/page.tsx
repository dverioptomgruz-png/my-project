'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, MessageSquare, BarChart3, Link2, Wifi, FlaskConical, ArrowUpDown, Users, Eye, MousePointerClick, Phone, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

export default function ModulesPage() {
  const [isOnline, setIsOnline] = useState(true);
  const [activeABTest, setActiveABTest] = useState<number | null>(0);

  const abTests = [
    {
      id: 1,
      name: 'Тест заголовка #12',
      status: 'active',
      variantA: { title: 'iPhone 15 Pro Max 256GB', views: 1240, contacts: 47, ctr: 3.8 },
      variantB: { title: 'iPhone 15 Pro Max - Ideal, Garantiya', views: 1180, contacts: 62, ctr: 5.3 },
      startDate: '10.02.2026',
      daysLeft: 4,
    },
    {
      id: 2,
      name: 'Тест фото #8',
      status: 'completed',
      variantA: { title: 'Foto na belom fone', views: 3400, contacts: 89, ctr: 2.6 },
      variantB: { title: 'Lifesyle foto', views: 3520, contacts: 134, ctr: 3.8 },
      startDate: '01.02.2026',
      daysLeft: 0,
    },
  ];

  const crmSystems = [
    { name: 'amoCRM', status: 'connected', leads: 156, synced: '2 мин назад' },
    { name: 'Bitrix24', status: 'available', leads: 0, synced: '-' },
    { name: 'YClients', status: 'available', leads: 0, synced: '-' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            <span className="bg-emerald-500 text-white rounded-lg px-2 py-1 text-sm">NA</span>
            Нейро-Ассистент
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border">
              <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
              <span className="text-sm font-medium">{isOnline ? 'В сети' : 'Не в сети'}</span>
              <button
                onClick={() => setIsOnline(!isOnline)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isOnline ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isOnline ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Демо-модули платформы</h1>
        <p className="text-muted-foreground mb-8">Управление модулями автоматизации Авито</p>

        {/* Stroka 1: 3 bazovyh modulya */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Биддер ставок
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Автоматическое управление ставками для удержания позиций</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span>Текущая ставка:</span><span className="font-semibold">245 ₽</span></div>
                <div className="flex justify-between text-sm"><span>Позиция:</span><span className="font-semibold text-emerald-600">3-е место</span></div>
                <div className="flex justify-between text-sm"><span>Статус:</span><span className="text-emerald-600">* Активен</span></div>
              </div>
              <Button className="w-full" variant="outline" size="sm">Настроить стратегию</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-emerald-500" />
                AI-Автоответчик
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Нейросеть отвечает на сообщения покупателей 24/7</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span>Сообщений сегодня:</span><span className="font-semibold">47</span></div>
                <div className="flex justify-between text-sm"><span>Обработано AI:</span><span className="font-semibold text-emerald-600">42 (89%)</span></div>
                <div className="flex justify-between text-sm"><span>Конверсия:</span><span className="font-semibold">32%</span></div>
              </div>
              <Button className="w-full" variant="outline" size="sm">Шаблоны ответов</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                Сквозная аналитика
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">ROI, ROMI, CPL в одном дашборде</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm"><span>ROI за месяц:</span><span className="font-semibold text-emerald-600">+187%</span></div>
                <div className="flex justify-between text-sm"><span>Просмотры:</span><span className="font-semibold">12,340</span></div>
                <div className="flex justify-between text-sm"><span>Конверсия:</span><span className="font-semibold">4.2%</span></div>
              </div>
              <Button className="w-full" variant="outline" size="sm">Открыть дашборд</Button>
            </CardContent>
          </Card>
        </div>

        {/* Stroka 2: CRM i A/B testirovanie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* CRM Интеграция */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5 text-emerald-500" />
                CRM Интеграция
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Авто-создание сделок, синхронизация контактов и истории переписки с вашей CRM
              </p>
              
              <div className="space-y-2">
                {crmSystems.map((crm, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {crm.status === 'connected' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-zinc-300" />
                      )}
                      <span className="font-medium text-sm">{crm.name}</span>
                    </div>
                    {crm.status === 'connected' ? (
                      <div className="text-xs text-muted-foreground">
                        {crm.leads} лидов | Синхр: {crm.synced}
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        Подключить
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t space-y-2">
                <div className="text-xs text-muted-foreground">Что передаётся в CRM:</div>
                <div className="flex flex-wrap gap-1.5">
                  {['Контакты', 'Сообщения', 'Объявления', 'Сделки'].map((item) => (
                    <span key={item} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <Button className="w-full" variant="outline" size="sm">
                Настроить интеграцию
              </Button>
            </CardContent>
          </Card>

          {/* A/B Тестирование */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5 text-emerald-500" />
                A/B Тестирование
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Тестируйте заголовки, фото, цены и описания для максимальной конверсии
              </p>

              <div className="space-y-2">
                {abTests.map((test, index) => (
                  <div
                    key={test.id}
                    onClick={() => setActiveABTest(activeABTest === index ? null : index)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activeABTest === index ? 'border-emerald-500 bg-emerald-500/5' : 'hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{test.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        test.status === 'active' 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : 'bg-zinc-500/10 text-zinc-500'
                      }`}>
                        {test.status === 'active' ? 'Активный' : 'Завершён'}
                      </span>
                    </div>
                    
                    {activeABTest === index && (
                      <div className="space-y-3 pt-2 border-t mt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 rounded bg-zinc-100 dark:bg-zinc-800">
                            <div className="text-xs text-muted-foreground mb-1">Вариант A</div>
                            <div className="text-xs font-medium truncate">{test.variantA.title}</div>
                            <div className="flex gap-2 mt-1 text-xs">
                              <span><Eye className="inline h-3 w-3" /> {test.variantA.views}</span>
                              <span><Phone className="inline h-3 w-3" /> {test.variantA.contacts}</span>
                              <span className="text-emerald-600">CTR {test.variantA.ctr}%</span>
                            </div>
                          </div>
                          <div className={`p-2 rounded ${
                            test.variantB.ctr > test.variantA.ctr 
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-1 ring-emerald-500' 
                              : 'bg-zinc-100 dark:bg-zinc-800'
                          }`}>
                            <div className="text-xs text-muted-foreground mb-1">Вариант B {test.variantB.ctr > test.variantA.ctr && '(Лидер)'}</div>
                            <div className="text-xs font-medium truncate">{test.variantB.title}</div>
                            <div className="flex gap-2 mt-1 text-xs">
                              <span><Eye className="inline h-3 w-3" /> {test.variantB.views}</span>
                              <span><Phone className="inline h-3 w-3" /> {test.variantB.contacts}</span>
                              <span className="text-emerald-600">CTR {test.variantB.ctr}%</span>
                            </div>
                          </div>
                        </div>
                        {test.status === 'active' && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Осталось {test.daysLeft} дней до завершения
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button className="w-full" variant="outline" size="sm">
                <Zap className="h-4 w-4 mr-1" /> Создать новый тест
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Link href="/">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
              Вернуться на главную

              
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
