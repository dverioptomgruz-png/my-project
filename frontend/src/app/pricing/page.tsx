import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Старт',
    price: '2 500',
    description: 'Для начинающих продавцов',
    accounts: 'до 2 аккаунтов',
    features: [
      { name: 'Биддер ставок', included: true },
      { name: 'Автозагрузка', included: true },
      { name: 'Базовая аналитика', included: true },
      { name: 'CRM Интеграция', included: true },
      { name: 'AI-Автоответчик', included: false },
      { name: 'Анализ конкурентов', included: false },
      { name: 'Сквозная аналитика', included: false },
      { name: 'Отзывы + AI', included: false },
      { name: 'A/B Тестирование', included: false },
      { name: 'Приоритетная поддержка', included: false },
    ],
    popular: false,
  },
  {
    name: 'Профи',
    price: '6 500',
    description: 'Полный функционал для бизнеса',
    accounts: 'до 5 аккаунтов',
    features: [
      { name: 'Биддер ставок', included: true },
      { name: 'Автозагрузка', included: true },
      { name: 'Базовая аналитика', included: true },
      { name: 'CRM Интеграция', included: true },
      { name: 'AI-Автоответчик', included: true },
      { name: 'Анализ конкурентов', included: true },
      { name: 'Сквозная аналитика', included: true },
      { name: 'Отзывы + AI', included: true },
      { name: 'A/B Тестирование', included: true },
      { name: 'Приоритетная поддержка', included: true },
    ],
    popular: true,
  },
  {
    name: 'Бизнес',
    price: '9 500',
    description: 'Для агентств и крупного бизнеса',
    accounts: 'безлимит аккаунтов',
    features: [
      { name: 'Биддер ставок', included: true },
      { name: 'Автозагрузка', included: true },
      { name: 'Базовая аналитика', included: true },
      { name: 'CRM Интеграция', included: true },
      { name: 'AI-Автоответчик', included: true },
      { name: 'Анализ конкурентов', included: true },
      { name: 'Сквозная аналитика', included: true },
      { name: 'Отзывы + AI', included: true },
      { name: 'A/B Тестирование', included: true },
      { name: 'Приоритетная поддержка', included: true },
    ],
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Тарифные планы</h1>
          <p className="text-xl text-muted-foreground">
            Выберите подходящий тариф для вашего бизнеса
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.popular
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                    Популярный
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground"> ₽/мес</span>
                  <p className="text-sm text-primary font-medium mt-2">
                    {plan.accounts}
                  </p>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span
                        className={feature.included ? '' : 'text-muted-foreground'}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  <Link href="/auth/register">Начать бесплатно</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Все тарифы включают 7 дней бесплатного пробного периода
          </p>
        </div>
      </div>
    </div>
  );
}
