'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  Star,
  Bot,
  CheckCircle2,
  Clock,
  Send,
  Edit3,
  Eye,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';

interface Review {
  id: string;
  avitoReviewId: string;
  rating: number;
  text: string | null;
  ts: string;
  status: string;
  aiReplyText: string | null;
  published: boolean;
}

const statusLabels: Record<string, string> = {
  NEW: 'Новый',
  AI_DRAFT: 'AI черновик',
  PUBLISHED: 'Опубликован',
  IGNORED: 'Пропущен',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning'> = {
  NEW: 'default',
  AI_DRAFT: 'warning',
  PUBLISHED: 'success',
  IGNORED: 'secondary',
};

export default function ReviewsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [aiReply, setAiReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const fetchReviews = async () => {
    try {
      const url = filter
        ? `/reviews?projectId=${projectId}&status=${filter}`
        : `/reviews?projectId=${projectId}`;
      const data = await api.get<Review[]>(url);
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Ошибка загрузки отзывов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [projectId, filter]);

  useEffect(() => {
    if (selectedReview) {
      setAiReply(selectedReview.aiReplyText || '');
    }
  }, [selectedReview]);

  const handleSaveAiReply = async () => {
    if (!selectedReview || !aiReply.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/reviews/${selectedReview.id}/ai-reply`, { aiReplyText: aiReply });
      toast.success('Ответ сохранён');
      setSelectedReview({ ...selectedReview, aiReplyText: aiReply, status: 'AI_DRAFT' });
      fetchReviews();
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedReview) return;
    setPublishing(true);
    try {
      await api.post(`/reviews/${selectedReview.id}/publish`, {});
      toast.success('Ответ опубликован');
      setSelectedReview({ ...selectedReview, published: true, status: 'PUBLISHED' });
      fetchReviews();
    } catch {
      toast.error('Ошибка публикации');
    } finally {
      setPublishing(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
          />
        ))}
      </div>
    );
  };

  // Stats
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;
  const newCount = reviews.filter((r) => r.status === 'NEW').length;
  const draftCount = reviews.filter((r) => r.status === 'AI_DRAFT').length;
  const publishedCount = reviews.filter((r) => r.status === 'PUBLISHED').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Отзывы</h1>
        <p className="text-muted-foreground">Управление отзывами и AI-ответами</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Средний рейтинг</p>
              <p className="text-xl font-bold">{avgRating.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Новые</p>
              <p className="text-xl font-bold">{newCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Bot className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">AI-черновики</p>
              <p className="text-xl font-bold">{draftCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Опубликовано</p>
              <p className="text-xl font-bold">{publishedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter || 'all'} onValueChange={(v) => setFilter(v === 'all' ? '' : v)}>
        <TabsList>
          <TabsTrigger value="all">Все ({reviews.length})</TabsTrigger>
          <TabsTrigger value="NEW">Новые</TabsTrigger>
          <TabsTrigger value="AI_DRAFT">AI-черновики</TabsTrigger>
          <TabsTrigger value="PUBLISHED">Опубликованные</TabsTrigger>
          <TabsTrigger value="IGNORED">Пропущенные</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Reviews List + Detail */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: reviews list */}
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">Нет отзывов</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card
                key={review.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  selectedReview?.id === review.id ? 'ring-2 ring-brand-500' : ''
                }`}
                onClick={() => setSelectedReview(review)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {renderStars(review.rating)}
                        <Badge variant={statusVariants[review.status] || 'secondary'}>
                          {statusLabels[review.status] || review.status}
                        </Badge>
                      </div>
                      <p className="text-sm line-clamp-2">
                        {review.text || 'Без текста'}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(review.ts).toLocaleDateString('ru-RU')}
                        </span>
                        {review.aiReplyText && (
                          <span className="flex items-center gap-1 text-brand-500">
                            <Bot className="h-3 w-3" />
                            AI-ответ готов
                          </span>
                        )}
                        {review.published && (
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="h-3 w-3" />
                            Опубликован
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold">
                      {review.rating}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Right: detail + AI reply editor */}
        <div>
          {selectedReview ? (
            <Card className="sticky top-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Отзыв #{selectedReview.avitoReviewId.slice(0, 8)}</CardTitle>
                  <Badge variant={statusVariants[selectedReview.status] || 'secondary'}>
                    {statusLabels[selectedReview.status] || selectedReview.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rating */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Рейтинг</p>
                  {renderStars(selectedReview.rating)}
                </div>

                {/* Original text */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Текст отзыва</p>
                  <div className="rounded-md bg-muted p-3 text-sm">
                    {selectedReview.text || 'Без текста'}
                  </div>
                </div>

                {/* AI Reply editor */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    AI-ответ
                  </p>
                  <textarea
                    className="w-full rounded-md border bg-background p-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={aiReply}
                    onChange={(e) => setAiReply(e.target.value)}
                    placeholder="Введите или отредактируйте ответ на отзыв..."
                    disabled={selectedReview.published}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!selectedReview.published && (
                    <>
                      <Button
                        onClick={handleSaveAiReply}
                        disabled={saving || !aiReply.trim()}
                        variant="secondary"
                        className="flex-1"
                      >
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Edit3 className="mr-2 h-4 w-4" />
                        )}
                        Сохранить черновик
                      </Button>
                      <Button
                        onClick={handlePublish}
                        disabled={publishing || !selectedReview.aiReplyText}
                        className="flex-1"
                      >
                        {publishing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Опубликовать
                      </Button>
                    </>
                  )}
                  {selectedReview.published && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Ответ опубликован
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-20 text-center">
                <Eye className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">Выберите отзыв</p>
                <p className="text-sm text-muted-foreground">Нажмите на отзыв слева для просмотра и ответа</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
