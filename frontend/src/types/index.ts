// ============================================================
// User & Auth
// ============================================================

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  role: "admin" | "user" | "manager";
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ============================================================
// Pagination
// ============================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ============================================================
// Project
// ============================================================

export interface Project {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: "owner" | "admin" | "editor" | "viewer";
  user: User;
  joinedAt: string;
}

// ============================================================
// Avito Account
// ============================================================

export interface AvitoAccount {
  id: string;
  projectId: string;
  name: string;
  clientId: string;
  clientSecret: string;
  isActive: boolean;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Item (Listing)
// ============================================================

export interface Item {
  id: string;
  projectId: string;
  avitoAccountId: string;
  avitoItemId: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  category: string | null;
  status: "active" | "blocked" | "removed" | "archived" | "rejected";
  url: string | null;
  imageUrls: string[];
  address: string | null;
  stats: ItemStats | null;
  isAutoloadManaged: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemStats {
  views: number;
  favorites: number;
  contacts: number;
}

// ============================================================
// Bidder
// ============================================================

export interface BidderRule {
  id: string;
  projectId: string;
  avitoAccountId: string;
  itemId: string | null;
  name: string;
  isActive: boolean;
  strategy: "position" | "budget" | "cpc_limit";
  targetPosition: number | null;
  maxBid: number | null;
  dailyBudget: number | null;
  schedule: BidderSchedule | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidderSchedule {
  daysOfWeek: number[];
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface BidderExecutionLog {
  id: string;
  ruleId: string;
  itemId: string;
  previousBid: number | null;
  newBid: number | null;
  previousPosition: number | null;
  newPosition: number | null;
  status: "success" | "error" | "skipped";
  errorMessage: string | null;
  executedAt: string;
}

// ============================================================
// Autoload
// ============================================================

export interface AutoloadReport {
  id: string;
  projectId: string;
  avitoAccountId: string;
  fileName: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalItems: number;
  processedItems: number;
  errorItems: number;
  errors: AutoloadError[];
  generatedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface AutoloadError {
  itemId: string;
  field: string;
  message: string;
}

// ============================================================
// Chat
// ============================================================

export interface ChatThread {
  id: string;
  projectId: string;
  avitoAccountId: string;
  avitoChatId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  itemId: string | null;
  itemTitle: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isAutoreplyEnabled: boolean;
  status: "active" | "closed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  avitoMessageId: string;
  direction: "incoming" | "outgoing";
  authorName: string;
  content: string;
  messageType: "text" | "image" | "link" | "system";
  isAutoReply: boolean;
  isRead: boolean;
  sentAt: string;
  createdAt: string;
}

// ============================================================
// Competitor Analysis
// ============================================================

export interface CompetitorSnapshot {
  id: string;
  projectId: string;
  itemId: string;
  competitorItemId: string;
  competitorTitle: string;
  competitorPrice: number;
  competitorUrl: string | null;
  competitorPosition: number | null;
  competitorSellerId: string | null;
  competitorSellerName: string | null;
  snapshotDate: string;
  createdAt: string;
}

// ============================================================
// Analytics
// ============================================================

export interface AnalyticsDaily {
  id: string;
  projectId: string;
  avitoAccountId: string | null;
  itemId: string | null;
  date: string;
  views: number;
  contacts: number;
  favorites: number;
  adSpend: number;
  revenue: number;
  conversions: number;
  averagePosition: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  createdAt: string;
}

// ============================================================
// Reviews
// ============================================================

export interface Review {
  id: string;
  projectId: string;
  avitoAccountId: string;
  avitoReviewId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  text: string;
  reply: string | null;
  repliedAt: string | null;
  itemId: string | null;
  itemTitle: string | null;
  status: "new" | "replied" | "ignored";
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// System Events
// ============================================================

export interface SystemEvent {
  id: string;
  projectId: string | null;
  userId: string | null;
  eventType:
    | "info"
    | "warning"
    | "error"
    | "critical"
    | "bidder_update"
    | "sync_complete"
    | "account_issue";
  source: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}
