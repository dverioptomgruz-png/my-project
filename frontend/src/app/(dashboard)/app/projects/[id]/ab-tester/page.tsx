'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FlaskConical, Play, Plus, Square, Trophy } from 'lucide-react';

interface ABVariant {
  id: string;
  index: number;
  name: string;
  title: string;
  price: number;
  views: number;
  contacts: number;
}

interface ABExperiment {
  id: string;
  name: string;
  status: string;
  duration: number;
  rotationInterval: number;
  currentVariantIndex: number | null;
  createdAt: string;
  variants: ABVariant[];
}

interface WinnerResult {
  winner?: ABVariant | null;
  ctr?: number;
}

interface FormState {
  name: string;
  category: string;
  baseTitle: string;
  baseDescription: string;
  basePrice: string;
  duration: string;
  rotationInterval: string;
}

const INIT_FORM: FormState = {
  name: '',
  category: 'general',
  baseTitle: '',
  baseDescription: '',
  basePrice: '0',
  duration: '7',
  rotationInterval: '24',
};

function statusBadge(status: string): 'success' | 'warning' | 'error' | 'secondary' {
  if (status === 'testing' || status === 'winner_found' || status === 'completed') return 'success';
  if (status === 'draft') return 'warning';
  if (status === 'failed') return 'error';
  return 'secondary';
}

export default function ABTesterPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INIT_FORM);
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);
  const [winnerMap, setWinnerMap] = useState<Record<string, WinnerResult>>({});

  const activeCount = useMemo(
    () => experiments.filter((e) => e.status === 'testing').length,
    [experiments]
  );

  const fetchExperiments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ABExperiment[]>(`/ab-tester/experiments?projectId=${projectId}`);
      setExperiments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error({
        title: 'Error',
        description: err?.message || 'Failed to load experiments',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, [projectId]);

  const updateForm = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.baseTitle.trim()) {
      toast.error({ title: 'Validation', description: 'Name and base title are required' });
      return;
    }

    const basePrice = Number(form.basePrice) || 0;

    setCreating(true);
    try {
      await api.post('/ab-tester/experiments', {
        projectId,
        name: form.name.trim(),
        category: form.category || 'general',
        baseTitle: form.baseTitle.trim(),
        baseDescription: form.baseDescription.trim(),
        basePrice,
        duration: Number(form.duration) || 7,
        rotationInterval: Number(form.rotationInterval) || 24,
        variants: [
          {
            name: 'Variant A',
            title: form.baseTitle.trim(),
            description: form.baseDescription.trim(),
            price: basePrice,
          },
          {
            name: 'Variant B',
            title: `${form.baseTitle.trim()} Premium`,
            description: form.baseDescription.trim(),
            price: Math.round(basePrice * 1.1),
          },
        ],
      });

      toast.success({ title: 'Created', description: 'Experiment created successfully' });
      setDialogOpen(false);
      setForm(INIT_FORM);
      await fetchExperiments();
    } catch (err: any) {
      toast.error({
        title: 'Create failed',
        description: err?.message || 'Failed to create experiment',
      });
    } finally {
      setCreating(false);
    }
  };

  const startExperiment = async (id: string) => {
    setActionId(id);
    try {
      await api.put(`/ab-tester/experiments/${id}/start`);
      toast.success({ title: 'Started', description: 'Experiment moved to testing' });
      await fetchExperiments();
    } catch (err: any) {
      toast.error({ title: 'Start failed', description: err?.message || 'Unable to start experiment' });
    } finally {
      setActionId(null);
    }
  };

  const stopExperiment = async (id: string) => {
    setActionId(id);
    try {
      await api.put(`/ab-tester/experiments/${id}/stop`);
      toast.success({ title: 'Stopped', description: 'Experiment was stopped' });
      await fetchExperiments();
    } catch (err: any) {
      toast.error({ title: 'Stop failed', description: err?.message || 'Unable to stop experiment' });
    } finally {
      setActionId(null);
    }
  };

  const detectWinner = async (id: string) => {
    setActionId(id);
    try {
      const { data } = await api.get<WinnerResult>(`/ab-tester/experiments/${id}/winner`);
      setWinnerMap((prev) => ({ ...prev, [id]: data || {} }));
      if (data?.winner) {
        toast.success({ title: 'Winner detected', description: `${data.winner.name} is currently best` });
      } else {
        toast.success({ title: 'Winner detection', description: 'No winner yet, collect more data' });
      }
      await fetchExperiments();
    } catch (err: any) {
      toast.error({ title: 'Winner detection failed', description: err?.message || 'Unable to detect winner' });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">A/B Tester</h1>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">
            Create variants, run tests, and choose a winner for Avito listings.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Experiment
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton height="18px" width="120px" />
                <Skeleton height="30px" width="64px" className="mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-2xl">{experiments.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active tests</CardDescription>
              <CardTitle className="text-2xl">{activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Winner found</CardDescription>
              <CardTitle className="text-2xl">
                {experiments.filter((e) => e.status === 'winner_found').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Experiments
          </CardTitle>
          <CardDescription>
            Primary flow: create, start, monitor, detect winner.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height="42px" width="100%" />
              ))}
            </div>
          ) : experiments.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No experiments yet. Create your first test.
            </div>
          ) : (
            <div className="space-y-2">
              {experiments.map((exp) => {
                const winner = winnerMap[exp.id]?.winner;
                const ctr = winnerMap[exp.id]?.ctr;
                const isBusy = actionId === exp.id;

                return (
                  <div
                    key={exp.id}
                    className="rounded-md border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{exp.name}</p>
                          <Badge variant={statusBadge(exp.status)}>{exp.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Variants: {exp.variants?.length || 0} • Duration: {exp.duration} days • Rotation:{' '}
                          {exp.rotationInterval}h
                        </p>
                        {winner && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            Winner: {winner.name} {typeof ctr === 'number' ? `(CTR: ${(ctr * 100).toFixed(2)}%)` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {exp.status !== 'testing' ? (
                          <Button size="sm" variant="outline" onClick={() => startExperiment(exp.id)} disabled={isBusy}>
                            <Play className="mr-1 h-4 w-4" />
                            Start
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => stopExperiment(exp.id)} disabled={isBusy}>
                            <Square className="mr-1 h-4 w-4" />
                            Stop
                          </Button>
                        )}
                        <Button size="sm" onClick={() => detectWinner(exp.id)} disabled={isBusy}>
                          <Trophy className="mr-1 h-4 w-4" />
                          Winner
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create A/B Experiment</DialogTitle>
            <DialogDescription>
              A new test will be created with two variants: A and B.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="A/B test for main product" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="general" />
            </div>
            <div className="space-y-1">
              <Label>Base title</Label>
              <Input value={form.baseTitle} onChange={(e) => updateForm('baseTitle', e.target.value)} placeholder="Product title" />
            </div>
            <div className="space-y-1">
              <Label>Base description</Label>
              <Input
                value={form.baseDescription}
                onChange={(e) => updateForm('baseDescription', e.target.value)}
                placeholder="Short listing description"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Price</Label>
                <Input value={form.basePrice} onChange={(e) => updateForm('basePrice', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Duration (days)</Label>
                <Input value={form.duration} onChange={(e) => updateForm('duration', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Rotation (h)</Label>
                <Input value={form.rotationInterval} onChange={(e) => updateForm('rotationInterval', e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
