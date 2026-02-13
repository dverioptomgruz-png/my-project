'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { Search, Globe, Clock, Eye, Loader2, ExternalLink, TrendingUp } from 'lucide-react';

interface Snapshot {
  id: string;
  query: string;
  ts: string;
  resultsJson: any;
}

export default function CompetitorsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    try {
      const data = await api.get<any>(`/competitors/snapshots?projectId=${projectId}&skip=0&take=30`);
      setSnapshots(Array.isArray(data) ? data : data.data || []);
    } catch {
      toast.error('Ошибка загрузки снимков');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [projectId]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      await api.post('/competitors/search', { projectId, query: query.trim() });
      toast.success('Поиск выполнен');
      setQuery('');
      fetchSnapshots();
    } catch {
      toast.error('Ошибка поиска');
    } finally {
      setSearching(false);
    }
  };

  const getResultsCount = (snap: Snapshot) => {
    if (!snap.resultsJson) return 0;
    if (Array.isArray(snap.resultsJson)) return snap.resultsJson.length;
    if (snap.resultsJson.results) return snap.resultsJson.results.length;
    return 0;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Анализ конкурентов</h1>
        <p className="text-muted-foreground">Поиск и мониторинг конкурентов через SearXNG</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Введите поисковый запрос (напр. 'iPhone 15 Москва')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching || !query.trim()}>
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Найти
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего снимков</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-brand-500" />
              <span className="text-2xl font-bold">{snapshots.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Уникальных запросов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-500" />
              <span className="text-2xl font-bold">
                {new Set(snapshots.map((s) => s.query)).size}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Последний поиск</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-500" />
              <span className="text-sm">
                {snapshots.length > 0
                  ? new Date(snapshots[0].ts).toLocaleString('ru-RU')
                  : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Snapshots Table */}
      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">Нет данных</p>
            <p className="text-sm text-muted-foreground">Выполните первый поиск конкурентов</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>История поисков</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Запрос</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Результатов</TableHead>
                  <TableHead className="w-24">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snap) => (
                  <>
                    <TableRow key={snap.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{snap.query}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(snap.ts).toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getResultsCount(snap)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedId(expandedId === snap.id ? null : snap.id)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedId === snap.id && (
                      <TableRow key={`${snap.id}-expanded`}>
                        <TableCell colSpan={4} className="bg-muted/30 p-4">
                          {snap.resultsJson ? (
                            <div className="space-y-3">
                              {(
                                Array.isArray(snap.resultsJson)
                                  ? snap.resultsJson
                                  : snap.resultsJson.results || []
                              )
                                .slice(0, 10)
                                .map((r: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-3 rounded-md border bg-card p-3"
                                  >
                                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                                      {i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">
                                        {r.title || r.name || 'Без названия'}
                                      </p>
                                      {r.url && (
                                        <a
                                          href={r.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          {r.url.slice(0, 60)}...
                                        </a>
                                      )}
                                      {r.content && (
                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                          {r.content}
                                        </p>
                                      )}
                                    </div>
                                    {r.price && (
                                      <Badge variant="outline">{r.price}</Badge>
                                    )}
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Нет данных</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
