'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Loader2,
  Inbox,
  MessagesSquare,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface ChatThread {
  id: string;
  projectId: string;
  avitoAccountId?: string;
  avitoChatId: string;
  userId?: string;
  userName?: string;
  userAvatarUrl?: string | null;
  itemId?: string | null;
  itemTitle?: string | null;
  lastMessageText?: string | null;
  lastMessageAt: string | null;
  unreadCount?: number;
  isAutoreplyEnabled?: boolean;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface ChatMessage {
  id: string;
  threadId: string;
  avitoMessageId?: string;
  direction: string;
  authorName?: string;
  content: string;
  text?: string;
  messageType?: string;
  isAutoReply?: boolean;
  isAiGenerated?: boolean;
  isRead?: boolean;
  sentAt?: string;
  createdAt: string;
}

type ThreadStatus = 'OPEN' | 'AI_HANDLED' | 'MANUAL' | 'CLOSED' | 'active' | 'closed' | 'archived';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'secondary' }> = {
  OPEN: { label: 'Открыт', variant: 'default' },
  AI_HANDLED: { label: 'ИИ обработал', variant: 'success' },
  MANUAL: { label: 'Ручной', variant: 'warning' },
  CLOSED: { label: 'Закрыт', variant: 'secondary' },
  active: { label: 'Активен', variant: 'default' },
  closed: { label: 'Закрыт', variant: 'secondary' },
  archived: { label: 'Архив', variant: 'secondary' },
};

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Открыт' },
  { value: 'AI_HANDLED', label: 'ИИ обработал' },
  { value: 'MANUAL', label: 'Ручной' },
  { value: 'CLOSED', label: 'Закрыт' },
];

// ============================================================
// Component
// ============================================================

export default function ChatPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Threads state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Send message state
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Status change state
  const [changingStatus, setChangingStatus] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Fetch threads
  // ============================================================

  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const { data } = await api.get<ChatThread[] | { items: ChatThread[] }>(
        `/chat/threads?projectId=${projectId}`
      );
      const list = Array.isArray(data) ? data : data.items ?? [];
      setThreads(list);
    } catch {
      toast.error({
        title: 'Ошибка',
        description: 'Не удалось загрузить чаты',
      });
    } finally {
      setThreadsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ============================================================
  // Fetch messages for selected thread
  // ============================================================

  const fetchMessages = useCallback(async (threadId: string) => {
    setMessagesLoading(true);
    try {
      const { data } = await api.get<ChatMessage[] | { items: ChatMessage[] }>(
        `/chat/threads/${threadId}/messages`
      );
      const list = Array.isArray(data) ? data : data.items ?? [];
      setMessages(list);
    } catch {
      toast.error({
        title: 'Ошибка',
        description: 'Не удалось загрузить сообщения',
      });
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      fetchMessages(selectedThreadId);
    } else {
      setMessages([]);
    }
  }, [selectedThreadId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================================
  // Send message
  // ============================================================

  const handleSendMessage = async () => {
    if (!selectedThreadId || !messageText.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post<ChatMessage>(
        `/chat/threads/${selectedThreadId}/messages`,
        { content: messageText.trim(), text: messageText.trim() }
      );
      setMessages((prev) => [...prev, data]);
      setMessageText('');
      // Update last message in threads list
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThreadId
            ? { ...t, lastMessageText: messageText.trim(), lastMessageAt: new Date().toISOString() }
            : t
        )
      );
    } catch {
      toast.error({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ============================================================
  // Change thread status
  // ============================================================

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedThreadId) return;
    setChangingStatus(true);
    try {
      await api.patch(`/chat/threads/${selectedThreadId}/status`, {
        status: newStatus,
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThreadId ? { ...t, status: newStatus } : t
        )
      );
      toast.success({ title: 'Успех', description: 'Статус чата обновлён' });
    } catch {
      toast.error({
        title: 'Ошибка',
        description: 'Не удалось обновить статус чата',
      });
    } finally {
      setChangingStatus(false);
    }
  };

  // ============================================================
  // Helpers
  // ============================================================

  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMessageTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncate = (str: string, len: number) => {
    if (str.length <= len) return str;
    return str.substring(0, len) + '...';
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, variant: 'secondary' as const };
  };

  const isInbound = (msg: ChatMessage) => {
    const dir = msg.direction?.toLowerCase();
    return dir === 'inbound' || dir === 'incoming' || dir === 'in';
  };

  const isAi = (msg: ChatMessage) => {
    return msg.isAutoReply || msg.isAiGenerated || false;
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Чат</h1>
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">
          Управление перепиской с клиентами Авито
        </p>
      </div>

      <div className="grid h-[calc(100vh-220px)] min-h-[500px] grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ============================== LEFT PANEL: THREAD LIST ============================== */}
        <Card className="flex flex-col lg:col-span-1">
          <CardHeader className="shrink-0 border-b border-[hsl(var(--border))] pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="h-4 w-4" />
              Диалоги
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {threadsLoading ? (
              <div className="space-y-1 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                    <Skeleton height="40px" width="40px" circle />
                    <div className="flex-1 space-y-1">
                      <Skeleton height="14px" width="70%" />
                      <Skeleton height="12px" width="50%" />
                    </div>
                  </div>
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <Inbox className="mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
                <p className="font-medium">Нет диалогов</p>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Диалоги появятся при поступлении сообщений от клиентов
                </p>
              </div>
            ) : (
              <div className="space-y-0.5 p-1">
                {threads.map((thread) => {
                  const statusCfg = getStatusConfig(thread.status);
                  const isSelected = thread.id === selectedThreadId;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-[hsl(var(--accent))]'
                          : 'hover:bg-[hsl(var(--muted))]/50'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {thread.userName || truncate(thread.avitoChatId, 12)}
                          </span>
                          <Badge variant={statusCfg.variant} className="shrink-0 text-[10px]">
                            {statusCfg.label}
                          </Badge>
                        </div>
                        {thread.itemTitle && (
                          <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {thread.itemTitle}
                          </p>
                        )}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                            {thread.lastMessageText
                              ? truncate(thread.lastMessageText, 40)
                              : 'Нет сообщений'}
                          </p>
                          <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
                            {formatTime(thread.lastMessageAt)}
                          </span>
                        </div>
                        {thread.unreadCount != null && thread.unreadCount > 0 && (
                          <span className="mt-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1.5 text-[10px] font-bold text-[hsl(var(--primary-foreground))]">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================== RIGHT PANEL: MESSAGES ============================== */}
        <Card className="flex flex-col lg:col-span-2">
          {!selectedThreadId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MessageSquare className="mb-4 h-16 w-16 text-[hsl(var(--muted-foreground))]" />
              <p className="text-lg font-medium">Выберите диалог</p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Выберите диалог из списка слева, чтобы просмотреть сообщения
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <CardHeader className="shrink-0 border-b border-[hsl(var(--border))] pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {selectedThread?.userName ||
                          truncate(selectedThread?.avitoChatId || '', 20)}
                      </p>
                      {selectedThread?.itemTitle && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          {selectedThread.itemTitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedThread?.status || ''}
                      onValueChange={handleStatusChange}
                      disabled={changingStatus}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Статус" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              {/* Messages area */}
              <CardContent className="flex-1 overflow-y-auto p-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className="space-y-1">
                          <Skeleton
                            height="40px"
                            width={`${Math.random() * 100 + 150}px`}
                          />
                          <Skeleton height="10px" width="60px" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="mb-3 h-10 w-10 text-[hsl(var(--muted-foreground))]" />
                    <p className="font-medium">Нет сообщений</p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Начните диалог, отправив первое сообщение
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const inbound = isInbound(msg);
                      const aiGenerated = isAi(msg);
                      const msgContent = msg.content || msg.text || '';
                      const msgTime = msg.sentAt || msg.createdAt;

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              inbound
                                ? 'rounded-tl-sm bg-[hsl(var(--muted))]'
                                : 'rounded-tr-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                            }`}
                          >
                            {aiGenerated && !inbound && (
                              <div className="mb-1 flex items-center gap-1">
                                <Bot className="h-3 w-3" />
                                <span className="text-[10px] opacity-80">
                                  ИИ-ответ
                                </span>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm">{msgContent}</p>
                            <p
                              className={`mt-1 text-right text-[10px] ${
                                inbound
                                  ? 'text-[hsl(var(--muted-foreground))]'
                                  : 'opacity-70'
                              }`}
                            >
                              {formatMessageTime(msgTime)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </CardContent>

              {/* Message input */}
              <div className="shrink-0 border-t border-[hsl(var(--border))] p-4">
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Введите сообщение..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={sending || !messageText.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
