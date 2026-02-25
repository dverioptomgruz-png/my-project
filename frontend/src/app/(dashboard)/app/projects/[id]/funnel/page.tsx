'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import {
  Eye,
  Heart,
  Users,
  MessageSquare,
  Phone,
  ArrowDown,
  Calculator,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface FunnelStep {
  name: string;
  value: number;
  conversion: number;
}

interface FunnelData {
  steps: FunnelStep[];
  totals: {
    views: number;
    favorites: number;
    contacts: number;
    chats: number;
    calls: number;
    spend: number;
  };
}

interface CalcResult {
  roi: number;
  romi: number;
  cpl: number;
  profit: number;
}

export default function FunnelPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Calculator state
  const [revenue, setRevenue] = useState('100000');
  const [spend, setSpend] = useState('20000');
  const [leads, setLeads] = useState('50');
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const fetchFunnel = async () => {
    setLoading(true);
    try {
      const response = await api.get<FunnelData>(
        `/funnel/data?projectId=${projectId}&from=${dateFrom}&to=${dateTo}`,
      );
      setFunnelData(response.data || null);
    } catch {
      toast.error('Ошибка загрузки воронки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
  }, [projectId]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const response = await api.post<CalcResult>('/funnel/calculate', {
        revenue: parseFloat(revenue) || 0,
        spend: parseFloat(spend) || 0,
        leads: parseInt(leads) || 0,
      });
      setCalcResult(response.data || null);
    } catch {
      toast.error('Ошибка расчёта');
    } finally {
      setCalculating(false);
    }
  };

  const funnelSteps = funnelData?.steps || [];
  const funnelChartData = funnelSteps.map((s) => ({
    name: s.name,
    value: s.value,
  }));

  const icons = [Eye, Heart, Users, MessageSquare, Phone];
  const colors = ['#2ba762', '#ec4899', '#3b82f6', '#8b5cf6', '#f59e0b'];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Воронка продаж</h1>
          <p className="text-muted-foreground">Анализ конверсий и калькуляторы ROI</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
          <Button onClick={fetchFunnel} variant="secondary" size="sm">Обновить</Button>
        </div>
      </div>

      <Tabs defaultValue="funnel">
        <TabsList>
          <TabsTrigger value="funnel">Воронка</TabsTrigger>
          <TabsTrigger value="calculator">Калькулятор</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="space-y-6">
          {/* Visual Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Воронка конверсий</CardTitle>
              <CardDescription>
                {dateFrom} — {dateTo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funnelSteps.map((step, i) => {
                  const Icon = icons[i] || Eye;
                  const maxWidth = funnelSteps[0]?.value || 1;
                  const widthPercent = Math.max(
                    ((step.value / maxWidth) * 100),
                    15,
                  );

                  return (
                    <div key={step.name}>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center gap-3 rounded-md px-4 py-3 text-white transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: colors[i] || '#666',
                            minWidth: '200px',
                          }}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium">{step.name}</span>
                          <span className="ml-auto font-bold">{step.value.toLocaleString('ru-RU')}</span>
                        </div>
                        {i > 0 && (
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {step.conversion.toFixed(1)}% конверсия
                          </span>
                        )}
                      </div>
                      {i < funnelSteps.length - 1 && (
                        <div className="flex items-center pl-6 py-1">
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Funnel Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">График воронки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis type="category" dataKey="name" fontSize={12} width={120} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2ba762" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calculator Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Калькулятор ROI/ROMI/CPL
                </CardTitle>
                <CardDescription>
                  Введите данные для расчёта ключевых метрик
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Выручка (₽)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="revenue"
                      type="number"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      className="pl-10"
                      placeholder="100000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spend">Рекламный расход (₽)</Label>
                  <div className="relative">
                    <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="spend"
                      type="number"
                      value={spend}
                      onChange={(e) => setSpend(e.target.value)}
                      className="pl-10"
                      placeholder="20000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leads">Количество лидов</Label>
                  <div className="relative">
                    <Target className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="leads"
                      type="number"
                      value={leads}
                      onChange={(e) => setLeads(e.target.value)}
                      className="pl-10"
                      placeholder="50"
                    />
                  </div>
                </div>
                <Separator />
                <Button onClick={handleCalculate} className="w-full" disabled={calculating}>
                  {calculating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="mr-2 h-4 w-4" />
                  )}
                  Рассчитать
                </Button>
              </CardContent>
            </Card>

            {/* Calculator Result */}
            <Card>
              <CardHeader>
                <CardTitle>Результаты расчёта</CardTitle>
              </CardHeader>
              <CardContent>
                {calcResult ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">ROI</p>
                      <p className={`text-3xl font-bold ${calcResult.roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {calcResult.roi.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Return on Investment
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">ROMI</p>
                      <p className={`text-3xl font-bold ${calcResult.romi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {calcResult.romi.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Return on Marketing Investment
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">CPL</p>
                      <p className="text-3xl font-bold text-amber-500">
                        {calcResult.cpl.toFixed(0)} ₽
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cost per Lead
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Прибыль</p>
                      <p className={`text-3xl font-bold ${calcResult.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {calcResult.profit.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Выручка − Расходы
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Calculator className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                    <p className="font-medium">Введите данные</p>
                    <p className="text-sm text-muted-foreground">Нажмите «Рассчитать» для получения результатов</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
