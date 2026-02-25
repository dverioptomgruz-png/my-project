'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Square, Trophy, Repeat, Upload, Save } from 'lucide-react';

type ABVariant = {
  id: string;
  name: string;
  index: number;
  title: string;
  description: string;
  price: number;
  images: string[];
  views: number;
  contacts: number;
  favorites: number;
};

type ABExperiment = {
  id: string;
  projectId: string | null;
  name: string;
  category: string;
  baseTitle: string;
  baseDescription: string;
  basePrice: number;
  duration: number;
  rotationInterval: number;
  status: string;
  currentVariantIndex: number | null;
  winnerVariantId: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  variants: ABVariant[];
};

type MetricDraft = Record<string, { views: string; contacts: string; favorites: string }>;

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'error'> = {
  draft: 'secondary',
  testing: 'warning',
  winner_found: 'success',
  completed: 'default',
};

export default function ABTesterPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);
  const [metricDraft, setMetricDraft] = useState<MetricDraft>({});

  const [form, setForm] = useState({
    name: '',
    category: 'general',
    baseTitle: '',
    baseDescription: '',
    basePrice: '0',
    duration: '7',
    rotationInterval: '24',
  });

  const selectedExperiment = useMemo(
    () => experiments.find((exp) => exp.status === 'testing') || experiments[0] || null,
    [experiments],
  );

  const fetchExperiments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<ABExperiment[]>(`/ab-tester/experiments?projectId=${projectId}`);
      const rows = Array.isArray(response.data) ? response.data : [];
      setExperiments(rows);

      const nextDraft: MetricDraft = {};
      for (const exp of rows) {
        for (const v of exp.variants || []) {
          nextDraft[v.id] = {
            views: String(v.views || 0),
            contacts: String(v.contacts || 0),
            favorites: String(v.favorites || 0),
          };
        }
      }
      setMetricDraft(nextDraft);
    } catch (error: any) {
      toast.error({
        title: 'Failed to load A/B experiments',
        description: error?.message || 'Request failed',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const createExperiment = async () => {
    if (!form.name || !form.baseTitle) {
      toast.error({ title: 'Name and base title are required' });
      return;
    }

    const basePrice = Math.max(0, Number(form.basePrice || 0));
    const baseDescription = form.baseDescription || form.baseTitle;
    const payload = {
      projectId,
      name: form.name,
      category: form.category || 'general',
      baseTitle: form.baseTitle,
      baseDescription,
      basePrice,
      duration: Math.max(1, Number(form.duration || 7)),
      rotationInterval: Math.max(1, Number(form.rotationInterval || 24)),
      variants: [
        {
          name: 'Variant A',
          title: form.baseTitle,
          description: baseDescription,
          price: basePrice,
        },
        {
          name: 'Variant B',
          title: `${form.baseTitle} | promo`,
          description: `${baseDescription}\nFast delivery and warranty support.`,
          price: Math.max(0, Math.round(basePrice * 0.98)),
        },
      ],
    };

    setSaving(true);
    try {
      await api.post('/ab-tester/experiments', payload);
      toast.success({ title: 'Experiment created' });
      setForm((prev) => ({ ...prev, name: '', baseTitle: '', baseDescription: '' }));
      await fetchExperiments();
    } catch (error: any) {
      toast.error({
        title: 'Failed to create experiment',
        description: error?.message || 'Request failed',
      });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (path: string, method: 'post' | 'get' = 'post', body?: unknown) => {
    try {
      if (method === 'post') {
        await api.post(path, body);
      } else {
        await api.get(path);
      }
      await fetchExperiments();
    } catch (error: any) {
      toast.error({
        title: 'Action failed',
        description: error?.message || 'Request failed',
      });
    }
  };

  const updateVariantMetrics = async (experimentId: string, variant: ABVariant) => {
    const draft = metricDraft[variant.id];
    if (!draft) return;

    try {
      await api.post(`/ab-tester/experiments/${experimentId}/metrics`, {
        variantId: variant.id,
        views: Math.max(0, Number(draft.views || 0)),
        contacts: Math.max(0, Number(draft.contacts || 0)),
        favorites: Math.max(0, Number(draft.favorites || 0)),
        mode: 'set',
        autoDetermineWinner: true,
      });
      toast.success({ title: `Metrics saved for ${variant.name}` });
      await fetchExperiments();
    } catch (error: any) {
      toast.error({
        title: 'Failed to save metrics',
        description: error?.message || 'Request failed',
      });
    }
  };

  const getCtr = (v: ABVariant) => (v.views > 0 ? ((v.contacts / v.views) * 100).toFixed(2) : '0.00');

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">A/B Tester</h1>
        <p className="text-muted-foreground">
          Create experiments, rotate variants, update metrics, and pick winners.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Experiment</CardTitle>
          <CardDescription>Quick setup with two default variants (A and B)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Kitchen pans test"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="general"
            />
          </div>
          <div className="space-y-2">
            <Label>Base title</Label>
            <Input
              value={form.baseTitle}
              onChange={(e) => setForm((p) => ({ ...p, baseTitle: e.target.value }))}
              placeholder="Cast iron pan 28cm"
            />
          </div>
          <div className="space-y-2">
            <Label>Base description</Label>
            <Input
              value={form.baseDescription}
              onChange={(e) => setForm((p) => ({ ...p, baseDescription: e.target.value }))}
              placeholder="Durable cookware for everyday use"
            />
          </div>
          <div className="space-y-2">
            <Label>Base price</Label>
            <Input
              type="number"
              value={form.basePrice}
              onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Duration (days) / Rotation (hours)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={form.duration}
                onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
              />
              <Input
                type="number"
                value={form.rotationInterval}
                onChange={(e) => setForm((p) => ({ ...p, rotationInterval: e.target.value }))}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <Button onClick={createExperiment} disabled={saving} className="w-full md:w-auto">
              {saving ? 'Creating...' : 'Create Experiment'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {experiments.map((exp) => {
          const winner = exp.variants.find((v) => v.id === exp.winnerVariantId);
          return (
            <Card key={exp.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{exp.name}</CardTitle>
                  <Badge variant={STATUS_VARIANT[exp.status] || 'outline'}>{exp.status}</Badge>
                </div>
                <CardDescription>
                  Variants: {exp.variants.length} | Duration: {exp.duration}d | Rotation: {exp.rotationInterval}h
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Current index: {exp.currentVariantIndex ?? 0}
                  {winner ? ` | Winner: ${winner.name}` : ''}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => runAction(`/ab-tester/experiments/${exp.id}/start`)}>
                    <Play className="mr-1 h-3.5 w-3.5" /> Start
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAction(`/ab-tester/experiments/${exp.id}/stop`)}>
                    <Square className="mr-1 h-3.5 w-3.5" /> Stop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAction(`/ab-tester/experiments/${exp.id}/rotate`)}>
                    <Repeat className="mr-1 h-3.5 w-3.5" /> Rotate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAction(`/ab-tester/experiments/${exp.id}/winner`, 'get')}>
                    <Trophy className="mr-1 h-3.5 w-3.5" /> Determine Winner
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      runAction(`/ab-tester/experiments/${exp.id}/publish`, 'post', {
                        variantIndex: exp.currentVariantIndex ?? 0,
                      })
                    }
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" /> Publish Current
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedExperiment && (
        <Card>
          <CardHeader>
            <CardTitle>Metrics: {selectedExperiment.name}</CardTitle>
            <CardDescription>Set views, contacts, and favorites for each variant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedExperiment.variants.map((v) => (
              <div key={v.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.title}</div>
                  </div>
                  <Badge variant="outline">CTR {getCtr(v)}%</Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  <Input
                    type="number"
                    value={metricDraft[v.id]?.views ?? String(v.views || 0)}
                    onChange={(e) =>
                      setMetricDraft((prev) => ({
                        ...prev,
                        [v.id]: {
                          ...(prev[v.id] || { views: '0', contacts: '0', favorites: '0' }),
                          views: e.target.value,
                        },
                      }))
                    }
                    placeholder="Views"
                  />
                  <Input
                    type="number"
                    value={metricDraft[v.id]?.contacts ?? String(v.contacts || 0)}
                    onChange={(e) =>
                      setMetricDraft((prev) => ({
                        ...prev,
                        [v.id]: {
                          ...(prev[v.id] || { views: '0', contacts: '0', favorites: '0' }),
                          contacts: e.target.value,
                        },
                      }))
                    }
                    placeholder="Contacts"
                  />
                  <Input
                    type="number"
                    value={metricDraft[v.id]?.favorites ?? String(v.favorites || 0)}
                    onChange={(e) =>
                      setMetricDraft((prev) => ({
                        ...prev,
                        [v.id]: {
                          ...(prev[v.id] || { views: '0', contacts: '0', favorites: '0' }),
                          favorites: e.target.value,
                        },
                      }))
                    }
                    placeholder="Favorites"
                  />
                  <Button variant="outline" onClick={() => updateVariantMetrics(selectedExperiment.id, v)}>
                    <Save className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
