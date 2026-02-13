'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FolderKanban,
  Plus,
  Settings,
  Calendar,
  Users,
  ArrowRight,
} from 'lucide-react';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Project[]>('/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      toast.error({ title: 'Ошибка', description: 'Не удалось загрузить проекты' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error({ title: 'Ошибка', description: 'Введите название проекта' });
      return;
    }

    setCreating(true);
    try {
      const { data } = await api.post<Project>('/projects', { name: newProjectName.trim() });
      setProjects((prev) => [...prev, data]);
      setDialogOpen(false);
      setNewProjectName('');
      toast.success({ title: 'Успех', description: 'Проект успешно создан' });
    } catch (err: any) {
      toast.error({
        title: 'Ошибка создания',
        description: err?.message || 'Не удалось создать проект',
      });
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Проекты</h1>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">
            Управление вашими проектами
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Создать проект
        </Button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton height="20px" width="180px" />
                <Skeleton height="14px" width="120px" className="mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton height="14px" width="160px" />
                <Skeleton height="14px" width="100px" className="mt-2" />
              </CardContent>
              <CardFooter>
                <Skeleton height="36px" width="100%" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FolderKanban className="mb-4 h-16 w-16 text-[hsl(var(--muted-foreground))]" />
          <h2 className="text-xl font-semibold">Нет проектов</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Создайте ваш первый проект, чтобы начать работу
          </p>
          <Button onClick={() => setDialogOpen(true)} className="mt-6 gap-2">
            <Plus className="h-4 w-4" />
            Создать первый проект
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <CardTitle className="text-base">{project.name}</CardTitle>
                  </div>
                  <Badge variant={project.isActive ? 'success' : 'secondary'}>
                    {project.isActive ? 'Активен' : 'Неактивен'}
                  </Badge>
                </div>
                {project.description && (
                  <CardDescription className="mt-2 line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Создан: {formatDate(project.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Link href={`/app/projects/${project.id}/settings`} className="flex-1">
                  <Button variant="outline" className="w-full gap-2">
                    <Settings className="h-4 w-4" />
                    Настройки
                  </Button>
                </Link>
                <Link href={`/app/projects/${project.id}/avito`}>
                  <Button variant="ghost" size="icon">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новый проект</DialogTitle>
            <DialogDescription>
              Введите название для вашего нового проекта. Вы сможете изменить его позже в настройках.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Название проекта</Label>
              <Input
                id="project-name"
                placeholder="Например: Мой магазин на Авито"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) {
                    handleCreateProject();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewProjectName('');
              }}
              disabled={creating}
            >
              Отмена
            </Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
