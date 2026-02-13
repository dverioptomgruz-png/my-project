'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import {
  BarChart3,
  Download,
  Eye,
  Heart,
  MessageSquare,
  Phone,
  TrendingUp,
  Users,
  DollarSign,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface AnalyticsData {
  id: string;
  date: string;
  views: number;
  favorites: number;
  contacts: number;
  chats: number;
  calls: number;
  spend: number;
  cpl: number | null;
  roi: number | null;
  romi: number | null;
}

export default function AnalyticsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await api.get<AnalyticsData[]>(
        `/analytics/daily?projectId=${projectId}&from=${dateFrom}&to=${dateTo}`,
      );
      setData(Array.isArray(result) ? result : []);
    } catch {
      toast.error('Ошибка загрузки аналитики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleExport = async () => {
    try {
      const csv = await api.get<string>(
        `/analytics/export?projectId=${projectId}&from=${dateFrom}&to=${dateTo}`,
      );
      const blob = new Blob([csv as any], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${projectId}_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV экспортирован');
    } catch {
      toast.error('Ошибка экспорта');
    }
  };

  // Totals
  const totals = data.reduce(
    (acc, d) => ({
      views: acc.views + d.views,
      favorites: acc.favorites + d.favorites,
      contacts: acc.contacts + d.contacts,
      chats: acc.chats + d.chats,
      calls: acc.calls + d.calls,
      spend: acc.spend + d.spend,
    }),
    { views: 0, favorites: 0, contacts: 0, chats: 0, calls: 0, spend: 0 },
  );

  const avgCpl = data.length > 0
    ? data.reduce((s, d) => s + (d.cpl || 0), 0) / data.filter((d) => d.cpl).length || 0
    : 0;
  const avgRoi = data.length > 0
    ? data.reduce((s, d) => s + (d.roi || 0), 0) / data.filter((d) => d.roi).length || 0
    : 0;

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
    views: d.views,
    favorites: d.favorites,
    contacts: d.contacts,
    chats: d.chats,
    calls: d.calls,
    spend: d.spend,
    cpl: d.cpl || 0,
    roi: d.roi || 0,
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Сквозная аналитика</h1>
          <p className="text-muted-foreground">Метрики, ROI, ROMI и CPL за период</p>
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
          <Button onClick={fetchData} variant="secondary" size="sm">
            Применить
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" /> Просмотры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.views.toLocaleString('ru-RU')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Контакты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.contacts.toLocaleString('ru-RU')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Расход
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.spend.toLocaleString('ru-RU')} ₽</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> ROI (сред.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <span className={avgRoi >= 0 ? 'text-green-600' : 'text-red-500'}>
                {avgRoi.toFixed(1)}%
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Heart className="h-5 w-5 text-pink-500" />
            <div>
              <p className="text-xs text-muted-foreground">Избранное</p>
              <p className="font-semibold">{totals.favorites}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Чаты</p>
              <p className="font-semibold">{totals.chats}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Звонки</p>
              <p className="font-semibold">{totals.calls}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">CPL (сред.)</p>
              <p className="font-semibold">{avgCpl.toFixed(0)} ₽</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Table */}
      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Графики</TabsTrigger>
          <TabsTrigger value="table">Таблица</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6">
          {/* Traffic Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Трафик и взаимодействия</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="views" name="Просмотры" stroke="#2ba762" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="favorites" name="Избранное" stroke="#ec4899" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="contacts" name="Контакты" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Spend & ROI */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Расходы</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="spend" name="Расход ₽" fill="#2ba762" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ROI и CPL</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis yAxisId="left" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="roi" name="ROI %" stroke="#2ba762" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="cpl" name="CPL ₽" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead className="text-right">Просм.</TableHead>
                    <TableHead className="text-right">Избр.</TableHead>
                    <TableHead className="text-right">Конт.</TableHead>
                    <TableHead className="text-right">Чаты</TableHead>
                    <TableHead className="text-right">Звонки</TableHead>
                    <TableHead className="text-right">Расход ₽</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{new Date(d.date).toLocaleDateString('ru-RU')}</TableCell>
                      <TableCell className="text-right">{d.views}</TableCell>
                      <TableCell className="text-right">{d.favorites}</TableCell>
                      <TableCell className="text-right">{d.contacts}</TableCell>
                      <TableCell className="text-right">{d.chats}</TableCell>
                      <TableCell className="text-right">{d.calls}</TableCell>
                      <TableCell className="text-right">{d.spend.toFixed(0)}</TableCell>
                      <TableCell className="text-right">
                        {d.cpl ? `${d.cpl.toFixed(0)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.roi != null ? (
                          <span className={d.roi >= 0 ? 'text-green-600' : 'text-red-500'}>
                            {d.roi.toFixed(1)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
