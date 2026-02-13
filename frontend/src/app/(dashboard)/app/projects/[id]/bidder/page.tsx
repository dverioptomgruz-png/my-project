'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  ListOrdered,
  ScrollText,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ============================================================
// Types
// ============================================================

interface BidderRule {
  id: string;
  name: string;
  strategy: string;
  minBid: number | null;
  maxBid: number | null;
  dailyBudget: number | null;
  enabled: boolean;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BidderLog {
  id: string;
  ruleId: string;
  timestamp: string;
  executedAt?: string;
  decision: string;
  status?: string;
  oldBid: number | null;
  previousBid?: number | null;
  newBid: number | null;
  position: number | null;
  newPosition?: number | null;
  spent: number | null;
}

type Strategy = 'HOLD_POSITION' | 'MIN_BID' | 'MAX_COVERAGE' | 'SCHEDULE_BASED';

const STRATEGY_LABELS: Record<Strategy, string> = {
  HOLD_POSITION: 'Удержание позиции',
  MIN_BID: 'Минимальная ставка',
  MAX_COVERAGE: 'Максимальный охват',
  SCHEDULE_BASED: 'По расписанию',
};

const STRATEGY_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'error'> = {
  HOLD_POSITION: 'default',
  MIN_BID: 'secondary',
  MAX_COVERAGE: 'success',
  SCHEDULE_BASED: 'warning',
};

const DECISION_COLORS: Record<string, 'success' | 'error' | 'warning' | 'secondary'> = {
  RAISE: 'success',
  LOWER: 'error',
  HOLD: 'warning',
  SKIP: 'secondary',
};

const DECISION_LABELS: Record<string, string> = {
  RAISE: 'Повышение',
  LOWER: 'Понижение',
  HOLD: 'Удержание',
  SKIP: 'Пропуск',
};

interface CreateRuleForm {
  name: string;
  strategy: Strategy;
  minBid: string;
  maxBid: string;
  dailyBudget: string;
}

const INITIAL_FORM: CreateRuleForm = {
  name: '',
  strategy: 'HOLD_POSITION',
  minBid: '',
  maxBid: '',
  dailyBudget: '',
};

// ============================================================
// Mock chart data
// ============================================================

function generateMockChartData() {
  const data = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      bid: Math.round((Math.random() * 50 + 30) * 100) / 100,
      position: Math.round(Math.random() * 8 + 1),
    });
  }
  return data;
}

// ============================================================
// Component
// ============================================================

export default function BidderPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Rules state
  const [rules, setRules] = useState<BidderRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BidderRule | null>(null);
  const [form, setForm] = useState<CreateRuleForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Logs state
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [logs, setLogs] = useState<BidderLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsSkip, setLogsSkip] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Charts state
  const [chartData] = useState(generateMockChartData);

  // ============================================================
  // Fetch rules
  // ============================================================

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const { data } = await api.get<BidderRule[] | { items: BidderRule[] }>(
        `/bidder/rules?projectId=${projectId}`
      );
      const rulesList = Array.isArray(data) ? data : data.items ?? [];
      setRules(rulesList);
    } catch {
      toast.error({ title: 'Ошибка', description: 'Не удалось загрузить правила биддера' });
    } finally {
      setRulesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ============================================================
  // Fetch logs
  // ============================================================

  const fetchLogs = useCallback(
    async (ruleId: string, skip: number, append: boolean) => {
      if (!append) setLogsLoading(true);
      else setLoadingMore(true);
      try {
        const { data } = await api.get<BidderLog[] | { items: BidderLog[] }>(
          `/bidder/logs/${ruleId}?skip=${skip}&take=20`
        );
        const logsList = Array.isArray(data) ? data : data.items ?? [];
        if (append) {
          setLogs((prev) => [...prev, ...logsList]);
        } else {
          setLogs(logsList);
        }
        setHasMoreLogs(logsList.length === 20);
      } catch {
        toast.error({ title: 'Ошибка', description: 'Не удалось загрузить журнал' });
      } finally {
        setLogsLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedRuleId) {
      setLogsSkip(0);
      setHasMoreLogs(true);
      fetchLogs(selectedRuleId, 0, false);
    } else {
      setLogs([]);
    }
  }, [selectedRuleId, fetchLogs]);

  const loadMoreLogs = () => {
    if (!selectedRuleId || loadingMore) return;
    const nextSkip = logsSkip + 20;
    setLogsSkip(nextSkip);
    fetchLogs(selectedRuleId, nextSkip, true);
  };

  // ============================================================
  // Create / Edit rule
  // ============================================================

  const openCreateDialog = () => {
    setEditingRule(null);
    setForm(INITIAL_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: BidderRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      strategy: (rule.strategy as Strategy) || 'HOLD_POSITION',
      minBid: rule.minBid != null ? String(rule.minBid) : '',
      maxBid: rule.maxBid != null ? String(rule.maxBid) : '',
      dailyBudget: rule.dailyBudget != null ? String(rule.dailyBudget) : '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error({ title: 'Ошибка', description: 'Введите название правила' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        strategy: form.strategy,
        minBid: form.minBid ? parseFloat(form.minBid) : null,
        maxBid: form.maxBid ? parseFloat(form.maxBid) : null,
        dailyBudget: form.dailyBudget ? parseFloat(form.dailyBudget) : null,
        projectId,
      };

      if (editingRule) {
        await api.patch(`/bidder/rules/${editingRule.id}`, payload);
        toast.success({ title: 'Успех', description: 'Правило обновлено' });
      } else {
        await api.post('/bidder/rules', payload);
        toast.success({ title: 'Успех', description: 'Правило создано' });
      }
      setDialogOpen(false);
      setForm(INITIAL_FORM);
      setEditingRule(null);
      await fetchRules();
    } catch (err: any) {
      toast.error({
        title: 'Ошибка',
        description: err?.message || 'Не удалось сохранить правило',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // Toggle rule
  // ============================================================

  const handleToggle = async (rule: BidderRule) => {
    try {
      await api.patch(`/bidder/rules/${rule.id}/toggle`);
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id
            ? { ...r, enabled: !r.enabled, isActive: !(r.isActive ?? r.enabled) }
            : r
        )
      );
    } catch {
      toast.error({ title: 'Ошибка', description: 'Не удалось переключить правило' });
    }
  };

  // ============================================================
  // Delete rule
  // ============================================================

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await api.delete(`/bidder/rules/${deleteConfirmId}`);
      toast.success({ title: 'Успех', description: 'Правило удалено' });
      setDeleteConfirmId(null);
      if (selectedRuleId === deleteConfirmId) {
        setSelectedRuleId(null);
      }
      await fetchRules();
    } catch {
      toast.error({ title: 'Ошибка', description: 'Не удалось удалить правило' });
    } finally {
      setDeleting(false);
    }
  };

  // ============================================================
  // Helpers
  // ============================================================

  const formatTimestamp = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return '—';
    return `${val.toFixed(2)} \u20BD`;
  };

  const getDecision = (log: BidderLog): string => {
    if (log.decision) return log.decision;
    if (log.status === 'success') {
      if (log.newBid != null && log.oldBid != null) {
        if (log.newBid > log.oldBid) return 'RAISE';
        if (log.newBid < log.oldBid) return 'LOWER';
        return 'HOLD';
      }
    }
    if (log.status === 'skipped') return 'SKIP';
    return 'HOLD';
  };

  const getRuleEnabled = (rule: BidderRule): boolean => {
    return rule.enabled ?? rule.isActive ?? false;
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Биддер</h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Управление правилами ставок и автоматическим биддингом
        </p>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <ListOrdered className="h-4 w-4" />
            Правила
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScrollText className="h-4 w-4" />
            Журнал
          </TabsTrigger>
          <TabsTrigger value="charts" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Графики
          </TabsTrigger>
        </TabsList>

        {/* ============================== RULES TAB ============================== */}
        <TabsContent value="rules">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Правила биддера</CardTitle>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Создать правило
              </Button>
            </CardHeader>
            <CardContent>
              {rulesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton height="16px" width="20%" />
                      <Skeleton height="22px" width="15%" />
                      <Skeleton height="16px" width="10%" />
                      <Skeleton height="16px" width="10%" />
                      <Skeleton height="16px" width="12%" />
                      <Skeleton height="24px" width="44px" />
                      <Skeleton height="32px" width="80px" />
                    </div>
                  ))}
                </div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ListOrdered className="mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-lg font-medium">Нет правил</p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Создайте первое правило для автоматического управления ставками
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Стратегия</TableHead>
                      <TableHead>Мин. ставка</TableHead>
                      <TableHead>Макс. ставка</TableHead>
                      <TableHead>Дневной бюджет</TableHead>
                      <TableHead>Активно</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const strategy = rule.strategy as Strategy;
                      return (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.name}</TableCell>
                          <TableCell>
                            <Badge variant={STRATEGY_VARIANTS[strategy] || 'outline'}>
                              {STRATEGY_LABELS[strategy] || rule.strategy}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(rule.minBid)}</TableCell>
                          <TableCell>{formatCurrency(rule.maxBid)}</TableCell>
                          <TableCell>{formatCurrency(rule.dailyBudget)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={getRuleEnabled(rule)}
                              onCheckedChange={() => handleToggle(rule)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(rule)}
                                title="Редактировать"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmId(rule.id)}
                                title="Удалить"
                              >
                                <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== LOGS TAB ============================== */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Журнал действий</CardTitle>
              <div className="w-64">
                <Select
                  value={selectedRuleId ?? ''}
                  onValueChange={(val) => setSelectedRuleId(val || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите правило" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((rule) => (
                      <SelectItem key={rule.id} value={rule.id}>
                        {rule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedRuleId ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ScrollText className="mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-lg font-medium">Выберите правило</p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Выберите правило из списка выше, чтобы просмотреть журнал его действий
                  </p>
                </div>
              ) : logsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton height="16px" width="18%" />
                      <Skeleton height="22px" width="12%" />
                      <Skeleton height="16px" width="10%" />
                      <Skeleton height="16px" width="10%" />
                      <Skeleton height="16px" width="8%" />
                      <Skeleton height="16px" width="10%" />
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ScrollText className="mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-lg font-medium">Журнал пуст</p>
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    Записи появятся после выполнения правила биддером
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Время</TableHead>
                        <TableHead>Решение</TableHead>
                        <TableHead>Старая ставка</TableHead>
                        <TableHead>Новая ставка</TableHead>
                        <TableHead>Позиция</TableHead>
                        <TableHead>Потрачено</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const decision = getDecision(log);
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {formatTimestamp(log.timestamp || log.executedAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={DECISION_COLORS[decision] || 'secondary'}>
                                {DECISION_LABELS[decision] || decision}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatCurrency(log.oldBid ?? log.previousBid)}
                            </TableCell>
                            <TableCell>{formatCurrency(log.newBid)}</TableCell>
                            <TableCell>
                              {log.position ?? log.newPosition ?? '—'}
                            </TableCell>
                            <TableCell>{formatCurrency(log.spent)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {hasMoreLogs && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        onClick={loadMoreLogs}
                        disabled={loadingMore}
                        className="gap-2"
                      >
                        {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                        Загрузить ещё
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================== CHARTS TAB ============================== */}
        <TabsContent value="charts">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Динамика ставок</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ fontWeight: 600 }}
                        formatter={(value: number) => [`${value.toFixed(2)} \u20BD`, 'Ставка']}
                      />
                      <Line
                        type="monotone"
                        dataKey="bid"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Ставка"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Динамика позиций</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis reversed fontSize={12} domain={[1, 10]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ fontWeight: 600 }}
                        formatter={(value: number) => [value, 'Позиция']}
                      />
                      <Line
                        type="monotone"
                        dataKey="position"
                        stroke="hsl(var(--chart-2, 220 70% 50%))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Позиция"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================== CREATE/EDIT DIALOG ============================== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Редактировать правило' : 'Создать правило'}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Измените параметры правила биддера'
                : 'Заполните параметры нового правила для автоматического управления ставками'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Название</Label>
              <Input
                id="rule-name"
                placeholder="Название правила"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Стратегия</Label>
              <Select
                value={form.strategy}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, strategy: val as Strategy }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите стратегию" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOLD_POSITION">Удержание позиции</SelectItem>
                  <SelectItem value="MIN_BID">Минимальная ставка</SelectItem>
                  <SelectItem value="MAX_COVERAGE">Максимальный охват</SelectItem>
                  <SelectItem value="SCHEDULE_BASED">По расписанию</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-bid">Мин. ставка (\u20BD)</Label>
                <Input
                  id="min-bid"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.minBid}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, minBid: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-bid">Макс. ставка (\u20BD)</Label>
                <Input
                  id="max-bid"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.maxBid}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, maxBid: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily-budget">Дневной бюджет (\u20BD, необязательно)</Label>
              <Input
                id="daily-budget"
                type="number"
                min="0"
                step="0.01"
                placeholder="Без ограничений"
                value={form.dailyBudget}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dailyBudget: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRule ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================== DELETE CONFIRMATION DIALOG ============================== */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить это правило? Это действие нельзя отменить.
              Все связанные журналы также будут удалены.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={deleting}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
