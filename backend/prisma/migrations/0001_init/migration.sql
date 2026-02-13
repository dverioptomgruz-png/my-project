-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER');
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
CREATE TYPE "AvitoAccountStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "BidderStrategy" AS ENUM ('HOLD_POSITION', 'MIN_BID', 'MAX_COVERAGE', 'SCHEDULE_BASED');
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'AI_HANDLED', 'MANUAL', 'CLOSED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "ReviewStatus" AS ENUM ('NEW', 'AI_DRAFT', 'PUBLISHED', 'IGNORED');
CREATE TYPE "EventLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- Users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Projects
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- Project Members
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleInProject" "ProjectRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- Avito Accounts
CREATE TABLE "avito_accounts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "avitoUserId" TEXT,
    "title" TEXT,
    "status" "AvitoAccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "scopes" TEXT[],
    "tokensEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "avito_accounts_pkey" PRIMARY KEY ("id")
);

-- Items
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "avitoItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT,
    "price" DOUBLE PRECISION,
    "url" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "items_avitoItemId_projectId_key" ON "items"("avitoItemId", "projectId");

-- Bidder Rules
CREATE TABLE "bidder_rules" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "strategy" "BidderStrategy" NOT NULL DEFAULT 'HOLD_POSITION',
    "minBid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxBid" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "dailyBudget" DOUBLE PRECISION,
    "schedule" JSONB,
    "itemFilter" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bidder_rules_pkey" PRIMARY KEY ("id")
);

-- Bidder Execution Logs
CREATE TABLE "bidder_execution_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT NOT NULL,
    "oldBid" DOUBLE PRECISION,
    "newBid" DOUBLE PRECISION,
    "position" INTEGER,
    "spent" DOUBLE PRECISION,
    "rawJson" JSONB,
    CONSTRAINT "bidder_execution_logs_pkey" PRIMARY KEY ("id")
);

-- Autoload Reports
CREATE TABLE "autoload_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL DEFAULT 0,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "rawJson" JSONB,
    CONSTRAINT "autoload_reports_pkey" PRIMARY KEY ("id")
);

-- Chat Threads
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "avitoChatId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "status" "ChatStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "chat_threads_avitoChatId_projectId_key" ON "chat_threads"("avitoChatId", "projectId");

-- Chat Messages
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" JSONB,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- Competitor Snapshots
CREATE TABLE "competitor_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultsJson" JSONB,
    CONSTRAINT "competitor_snapshots_pkey" PRIMARY KEY ("id")
);

-- Analytics Daily
CREATE TABLE "analytics_daily" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "contacts" INTEGER NOT NULL DEFAULT 0,
    "chats" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpl" DOUBLE PRECISION,
    "roi" DOUBLE PRECISION,
    "romi" DOUBLE PRECISION,
    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_daily_projectId_date_key" ON "analytics_daily"("projectId", "date");

-- Reviews
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "avitoReviewId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReviewStatus" NOT NULL DEFAULT 'NEW',
    "aiReplyText" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reviews_avitoReviewId_projectId_key" ON "reviews"("avitoReviewId", "projectId");

-- System Event Logs
CREATE TABLE "system_event_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "level" "EventLevel" NOT NULL DEFAULT 'INFO',
    "module" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" JSONB,
    CONSTRAINT "system_event_logs_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "avito_accounts" ADD CONSTRAINT "avito_accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bidder_rules" ADD CONSTRAINT "bidder_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bidder_execution_logs" ADD CONSTRAINT "bidder_execution_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "bidder_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autoload_reports" ADD CONSTRAINT "autoload_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competitor_snapshots" ADD CONSTRAINT "competitor_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_event_logs" ADD CONSTRAINT "system_event_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
