'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  UserCircle,
  Mail,
  Shield,
  Calendar,
  Save,
  CheckCircle2,
} from 'lucide-react';
import type { User } from '@/types';

const ROLE_LABELS: Record<User['role'], string> = {
  admin: 'Администратор',
  user: 'Пользователь',
  manager: 'Менеджер',
};

const ROLE_BADGE_VARIANT: Record<User['role'], 'default' | 'success' | 'secondary'> = {
  admin: 'default',
  manager: 'success',
  user: 'secondary',
};

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const { data } = await api.get<User>('/auth/profile');
        setProfile(data);
        setFullName(data.fullName || '');
      } catch {
        toast.error({ title: 'Ошибка', description: 'Не удалось загрузить профиль' });
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error({ title: 'Ошибка', description: 'Имя не может быть пустым' });
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.patch<User>('/users/profile', {
        fullName: fullName.trim(),
      });
      setProfile(data);
      await refreshProfile();
      toast.success({ title: 'Сохранено', description: 'Профиль успешно обновлен' });
    } catch (err: any) {
      toast.error({
        title: 'Ошибка сохранения',
        description: err?.message || 'Не удалось обновить профиль',
      });
    } finally {
      setSaving(false);
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
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Skeleton height="32px" width="200px" />
          <Skeleton height="16px" width="300px" className="mt-2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton height="20px" width="180px" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton height="80px" width="80px" circle />
              <div className="space-y-2">
                <Skeleton height="20px" width="160px" />
                <Skeleton height="14px" width="200px" />
              </div>
            </div>
            <Skeleton height="40px" width="100%" />
            <Skeleton height="40px" width="100%" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="flex flex-col items-center justify-center py-16">
          <UserCircle className="mb-4 h-16 w-16 text-[hsl(var(--muted-foreground))]" />
          <h2 className="text-xl font-semibold">Профиль не найден</h2>
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">
            Не удалось загрузить данные профиля
          </p>
        </Card>
      </div>
    );
  }

  const hasChanges = fullName.trim() !== (profile.fullName || '');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Профиль</h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Управление вашими личными данными
        </p>
      </div>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Личная информация
          </CardTitle>
          <CardDescription>
            Ваши основные данные учетной записи
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Summary */}
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
              <UserCircle className="h-12 w-12 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{profile.fullName}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{profile.email}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={ROLE_BADGE_VARIANT[profile.role]} className="gap-1">
                  <Shield className="h-3 w-3" />
                  {ROLE_LABELS[profile.role]}
                </Badge>
                {profile.isVerified && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Подтвержден
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Edit Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Полное имя</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Введите ваше полное имя"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hasChanges && !saving) {
                    handleSave();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                helperText="Email нельзя изменить"
              />
            </div>

            <div className="space-y-2">
              <Label>Роль</Label>
              <div className="flex h-10 items-center rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--muted))]/50 px-3">
                <Badge variant={ROLE_BADGE_VARIANT[profile.role]} className="gap-1">
                  <Shield className="h-3 w-3" />
                  {ROLE_LABELS[profile.role]}
                </Badge>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Роль назначается администратором системы
              </p>
            </div>
          </div>

          <Separator />

          {/* Account Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
              Информация об аккаунте
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <Calendar className="h-4 w-4" />
                  Дата регистрации
                </span>
                <span>{formatDate(profile.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <Calendar className="h-4 w-4" />
                  Последнее обновление
                </span>
                <span>{formatDate(profile.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[hsl(var(--muted-foreground))]">Статус аккаунта</span>
                <Badge variant={profile.isActive ? 'success' : 'error'}>
                  {profile.isActive ? 'Активен' : 'Заблокирован'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
