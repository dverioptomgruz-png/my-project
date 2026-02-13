'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Settings,
  Users,
  AlertTriangle,
  Trash2,
  Save,
  UserPlus,
  Shield,
  Crown,
  Pencil,
  Eye,
} from 'lucide-react';
import type { Project, ProjectMember } from '@/types';

const ROLE_LABELS: Record<ProjectMember['role'], string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  editor: 'Редактор',
  viewer: 'Наблюдатель',
};

const ROLE_ICONS: Record<ProjectMember['role'], typeof Crown> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

const ROLE_BADGE_VARIANT: Record<ProjectMember['role'], 'default' | 'secondary' | 'success' | 'warning'> = {
  owner: 'default',
  admin: 'success',
  editor: 'warning',
  viewer: 'secondary',
};

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Add member form
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<ProjectMember['role']>('viewer');
  const [addingMember, setAddingMember] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, membersRes] = await Promise.allSettled([
        api.get<Project>(`/projects/${projectId}`),
        api.get<ProjectMember[]>(`/projects/${projectId}/members`),
      ]);

      if (projectRes.status === 'fulfilled') {
        const p = projectRes.value.data;
        setProject(p);
        setProjectName(p.name);
        setProjectDescription(p.description || '');
      } else {
        toast.error({ title: 'Ошибка', description: 'Проект не найден' });
        router.push('/app/projects');
        return;
      }

      if (membersRes.status === 'fulfilled') {
        setMembers(Array.isArray(membersRes.value.data) ? membersRes.value.data : []);
      }
    } catch {
      toast.error({ title: 'Ошибка', description: 'Не удалось загрузить данные проекта' });
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSaveSettings = async () => {
    if (!projectName.trim()) {
      toast.error({ title: 'Ошибка', description: 'Название проекта не может быть пустым' });
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.patch<Project>(`/projects/${projectId}`, {
        name: projectName.trim(),
        description: projectDescription.trim() || null,
      });
      setProject(data);
      toast.success({ title: 'Сохранено', description: 'Настройки проекта обновлены' });
    } catch (err: any) {
      toast.error({
        title: 'Ошибка сохранения',
        description: err?.message || 'Не удалось сохранить настройки',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) {
      toast.error({ title: 'Ошибка', description: 'Введите email участника' });
      return;
    }

    setAddingMember(true);
    try {
      const { data } = await api.post<ProjectMember>(`/projects/${projectId}/members`, {
        email: memberEmail.trim(),
        role: memberRole,
      });
      setMembers((prev) => [...prev, data]);
      setMemberEmail('');
      setMemberRole('viewer');
      toast.success({ title: 'Успех', description: 'Участник добавлен в проект' });
    } catch (err: any) {
      toast.error({
        title: 'Ошибка',
        description: err?.message || 'Не удалось добавить участника',
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await api.delete(`/projects/${projectId}/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success({ title: 'Успех', description: 'Участник удален из проекта' });
    } catch (err: any) {
      toast.error({
        title: 'Ошибка',
        description: err?.message || 'Не удалось удалить участника',
      });
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmText !== project?.name) {
      toast.error({ title: 'Ошибка', description: 'Название проекта введено неверно' });
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/projects/${projectId}`);
      toast.success({ title: 'Удалено', description: 'Проект успешно удален' });
      router.push('/app/projects');
    } catch (err: any) {
      toast.error({
        title: 'Ошибка удаления',
        description: err?.message || 'Не удалось удалить проект',
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton height="32px" width="250px" />
          <Skeleton height="16px" width="180px" className="mt-2" />
        </div>
        <Skeleton height="48px" width="100%" />
        <Card>
          <CardHeader>
            <Skeleton height="20px" width="200px" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton height="40px" width="100%" />
            <Skeleton height="40px" width="100%" />
            <Skeleton height="40px" width="200px" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройки проекта</h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">{project.name}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            Основные
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Участники
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Опасная зона
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Основные настройки</CardTitle>
              <CardDescription>
                Измените название и описание проекта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Название проекта</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Введите название проекта"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Описание</Label>
                <Input
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Краткое описание проекта (необязательно)"
                />
              </div>
              <Separator />
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                <p>Дата создания: {formatDate(project.createdAt)}</p>
                <p>Последнее обновление: {formatDate(project.updatedAt)}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSettings} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Members */}
        <TabsContent value="members">
          <div className="space-y-6">
            {/* Add Member Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Добавить участника
                </CardTitle>
                <CardDescription>
                  Пригласите нового участника в проект по email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex-1">
                    <Label htmlFor="member-email">Email участника</Label>
                    <Input
                      id="member-email"
                      type="email"
                      placeholder="user@example.com"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !addingMember) {
                          handleAddMember();
                        }
                      }}
                    />
                  </div>
                  <div className="w-full sm:w-48">
                    <Label>Роль</Label>
                    <Select value={memberRole} onValueChange={(v) => setMemberRole(v as ProjectMember['role'])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите роль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="editor">Редактор</SelectItem>
                        <SelectItem value="viewer">Наблюдатель</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddMember} disabled={addingMember} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      {addingMember ? 'Добавление...' : 'Добавить'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Members List */}
            <Card>
              <CardHeader>
                <CardTitle>Участники проекта</CardTitle>
                <CardDescription>
                  {members.length === 0
                    ? 'В проекте пока нет участников'
                    : `Всего участников: ${members.length}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
                    <p className="text-[hsl(var(--muted-foreground))]">
                      Нет участников. Добавьте первого участника выше.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Участник</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>Дата вступления</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => {
                        const RoleIcon = ROLE_ICONS[member.role];
                        return (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.user?.fullName || 'Неизвестный'}
                            </TableCell>
                            <TableCell className="text-[hsl(var(--muted-foreground))]">
                              {member.user?.email || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={ROLE_BADGE_VARIANT[member.role]} className="gap-1">
                                <RoleIcon className="h-3 w-3" />
                                {ROLE_LABELS[member.role]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[hsl(var(--muted-foreground))]">
                              {formatDate(member.joinedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              {member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Danger Zone */}
        <TabsContent value="danger">
          <Card className="border-[hsl(var(--destructive))]/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[hsl(var(--destructive))]">
                <AlertTriangle className="h-5 w-5" />
                Опасная зона
              </CardTitle>
              <CardDescription>
                Необратимые действия с проектом. Будьте осторожны.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-[hsl(var(--destructive))]/30 p-4">
                <h3 className="font-semibold">Удалить проект</h3>
                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                  Удаление проекта приведет к безвозвратной потере всех данных, включая
                  подключенные аккаунты Авито, правила биддера и историю аналитики.
                  Это действие нельзя отменить.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="mt-4 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить проект
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--destructive))]">
              <AlertTriangle className="h-5 w-5" />
              Удаление проекта
            </DialogTitle>
            <DialogDescription>
              Это действие нельзя отменить. Все данные проекта будут безвозвратно удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">
              Для подтверждения введите название проекта:{' '}
              <span className="font-semibold">{project.name}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">Название проекта</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={project.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={deleting}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleting || deleteConfirmText !== project.name}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Удаление...' : 'Удалить навсегда'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
