'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileCode,
  BarChart3,
  Package,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface AutoloadReport {
  id: string;
  projectId: string;
  avitoAccountId?: string;
  fileName?: string;
  status?: string;
  timestamp?: string;
  createdAt?: string;
  generatedAt?: string;
  totalItems: number;
  total?: number;
  ok: number;
  processedItems?: number;
  failed: number;
  errorItems?: number;
  rawJson?: string | Record<string, unknown>;
  errors?: Array<{ itemId: string; field: string; message: string }>;
}

// ============================================================
// Helpers
// ============================================================

function getTotal(report: AutoloadReport): number {
  return report.totalItems ?? report.total ?? 0;
}

function getOk(report: AutoloadReport): number {
  return report.ok ?? report.processedItems ?? 0;
}

function getFailed(report: AutoloadReport): number {
  return report.failed ?? report.errorItems ?? 0;
}

function getTimestamp(report: AutoloadReport): string {
  return report.timestamp || report.createdAt || report.generatedAt || '';
}

function getStatusBadge(report: AutoloadReport): {
  variant: 'success' | 'warning' | 'error';
  label: string;
} {
  const total = getTotal(report);
  const failed = getFailed(report);
  const ok = getOk(report);

  if (failed === 0 && ok > 0) {
    return { variant: 'success', label: 'Все успешно' };
  }
  if (total > 0 && failed > total / 2) {
    return { variant: 'error', label: 'Критические ошибки' };
  }
  if (failed > 0) {
    return { variant: 'warning', label: 'Есть ошибки' };
  }
  if (report.status === 'completed') {
    return { variant: 'success', label: 'Завершено' };
  }
  if (report.status === 'failed') {
    return { variant: 'error', label: 'Ошибка' };
  }
  if (report.status === 'processing') {
    return { variant: 'warning', label: 'В обработке' };
  }
  return { variant: 'success', label: 'Ок' };
}

// ============================================================
// Component
// ============================================================

export default function AutoloadPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [reports, setReports] = useState<AutoloadReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ============================================================
  // Fetch reports
  // ============================================================

  const fetchReports = useCallback(
    async (currentSkip: number, append: boolean) => {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      try {
        const { data } = await api.get<
          AutoloadReport[] | { items: AutoloadReport[] }
        >(`/autoload/reports?projectId=${projectId}&skip=${currentSkip}&take=20`);
        const list = Array.isArray(data) ? data : data.items ?? [];
        if (append) {
          setReports((prev) => [...prev, ...list]);
        } else {
          setReports(list);
        }
        setHasMore(list.length === 20);
      } catch {
        toast.error({
          title: 'Ошибка',
          description: 'Не удалось загрузить отчёты автозагрузки',
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    setSkip(0);
    fetchReports(0, false);
  }, [fetchReports]);

  const loadMore = () => {
    if (loadingMore) return;
    const nextSkip = skip + 20;
    setSkip(nextSkip);
    fetchReports(nextSkip, true);
  };

  // ============================================================
  // Summary calculations
  // ============================================================

  const totalReports = reports.length;

  const lastReport = reports.length > 0 ? reports[0] : null;
  const lastReportStatus = lastReport ? getStatusBadge(lastReport) : null;

  const successRate =
    reports.length > 0
      ? Math.round(
          (reports.reduce((sum: number, r: AutoloadReport) => sum + getOk(r), 0) /
            Math.max(reports.reduce((sum: number, r: AutoloadReport) => sum + getTotal(r), 0), 1)) *
            100
        )
      : 0;

  // ============================================================
  // Helpers
  // ============================================================

  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getRawContent = (report: AutoloadReport): string => {
    if (report.rawJson) {
      if (typeof report.rawJson === 'string') return report.rawJson;
      return JSON.stringify(report.rawJson, null, 2);
    }
    if (report.errors && report.errors.length > 0) {
      return JSON.stringify(report.errors, null, 2);
    }
    return JSON.stringify(
      {
        id: report.id,
        totalItems: getTotal(report),
        ok: getOk(report),
        failed: getFailed(report),
        status: report.status,
      },
      null,
      2
    );
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Автозагрузка</h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Отчёты и статус автозагрузки объявлений
        </p>
      </div>

      {/* ============================== SUMMARY CARDS ============================== */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton height="40px" width="40px" circle />
                <div className="space-y-1">
                  <Skeleton height="24px" width="60px" />
                  <Skeleton height="14px" width="120px" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalReports}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Всего отчётов
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                {lastReportStatus ? (
                  <>
                    <Badge variant={lastReportStatus.variant}>
                      {lastReportStatus.label}
                    </Badge>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      Последний отчёт
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">—</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      Последний отчёт
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{successRate}%</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Успешность загрузки
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================== REPORTS TABLE ============================== */}
      <Card>
        <CardHeader>
          <CardTitle>Отчёты автозагрузки</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton height="16px" width="18%" />
                  <Skeleton height="16px" width="10%" />
                  <Skeleton height="16px" width="8%" />
                  <Skeleton height="16px" width="8%" />
                  <Skeleton height="22px" width="12%" />
                  <Skeleton height="32px" width="80px" />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
              <p className="text-lg font-medium">Нет отчётов</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Отчёты появятся после первой автозагрузки объявлений
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Всего</TableHead>
                    <TableHead>Успешно</TableHead>
                    <TableHead>Ошибки</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => {
                    const status = getStatusBadge(report);
                    const total = getTotal(report);
                    const ok = getOk(report);
                    const failed = getFailed(report);
                    const isExpanded = expandedId === report.id;

                    return (
                      <TableRow key={report.id} className="group">
                        <TableCell className="text-sm">
                          {formatTimestamp(getTimestamp(report))}
                        </TableCell>
                        <TableCell className="font-medium">{total}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {ok}
                          </span>
                        </TableCell>
                        <TableCell>
                          {failed > 0 ? (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              {failed}
                            </span>
                          ) : (
                            <span className="text-[hsl(var(--muted-foreground))]">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => toggleExpand(report.id)}
                          >
                            <FileCode className="h-4 w-4" />
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Expanded raw JSON panels rendered below the table */}
              {expandedId && (
                <div className="mt-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Подробности отчёта
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(null)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded-md bg-[hsl(var(--background))] p-4 text-xs">
                    {getRawContent(
                      reports.find((r) => r.id === expandedId)!
                    )}
                  </pre>
                </div>
              )}

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
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
    </div>
  );
}
