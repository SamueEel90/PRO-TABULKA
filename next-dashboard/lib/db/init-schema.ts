/**
 * Auto-generated SQLite schema dump. Regenerate with: npm run db:dump-schema
 *
 * Used by lib/db/bootstrap.ts to initialize an empty /tmp/cache.db on Vercel
 * cold start. Bundled into the deploy artifact as plain code (no fs reads).
 */
export const INIT_SCHEMA_SQL = `CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gfName" TEXT,
    "vklName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" DATETIME,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL,
    "gfName" TEXT,
    "vklName" TEXT,
    "primaryStoreId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_primaryStoreId_fkey" FOREIGN KEY ("primaryStoreId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

CREATE TABLE "Metric" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "unit" TEXT,
    "aggregation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Month" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "businessYear" INTEGER NOT NULL,
    "businessOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthId" TEXT,
    CONSTRAINT "ImportBatch_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "Month" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MonthlyValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonthlyValue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MonthlyValue_metricCode_fkey" FOREIGN KEY ("metricCode") REFERENCES "Metric" ("code") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyValue_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "Month" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonthlyValue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DashboardNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "storeId" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DashboardNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "NoteComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "metricKey" TEXT,
    "monthLabel" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdByRole" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByName" TEXT,
    "completedAt" DATETIME,
    "sourceCommentId" TEXT,
    CONSTRAINT "TaskItem_sourceCommentId_fkey" FOREIGN KEY ("sourceCommentId") REFERENCES "NoteComment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metricKey" TEXT,
    "monthLabel" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "UserLastSeen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "IstAdjustmentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "oldValue" REAL NOT NULL,
    "newValue" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "vklName" TEXT,
    "decidedAt" DATETIME,
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IstAdjustmentRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WeeklyVodOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "rangeLabel" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "distributionMode" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyVodOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "User_role_idx" ON "User"("role");

CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

CREATE INDEX "MonthlyValue_storeId_monthId_idx" ON "MonthlyValue"("storeId", "monthId");

CREATE INDEX "MonthlyValue_monthId_source_idx" ON "MonthlyValue"("monthId", "source");

CREATE UNIQUE INDEX "MonthlyValue_source_storeId_metricCode_monthId_key" ON "MonthlyValue"("source", "storeId", "metricCode", "monthId");

CREATE INDEX "DashboardNote_scopeKey_metricKey_idx" ON "DashboardNote"("scopeKey", "metricKey");

CREATE UNIQUE INDEX "DashboardNote_scopeKey_role_metricKey_key" ON "DashboardNote"("scopeKey", "role", "metricKey");

CREATE INDEX "NoteComment_scopeKey_metricKey_createdAt_idx" ON "NoteComment"("scopeKey", "metricKey", "createdAt");

CREATE UNIQUE INDEX "TaskItem_sourceCommentId_key" ON "TaskItem"("sourceCommentId");

CREATE INDEX "TaskItem_scopeKey_status_idx" ON "TaskItem"("scopeKey", "status");

CREATE INDEX "TaskItem_scopeKey_metricKey_idx" ON "TaskItem"("scopeKey", "metricKey");

CREATE INDEX "ActivityEntry_scopeKey_createdAt_idx" ON "ActivityEntry"("scopeKey", "createdAt");

CREATE INDEX "UserLastSeen_userId_idx" ON "UserLastSeen"("userId");

CREATE UNIQUE INDEX "UserLastSeen_userId_scopeKey_key" ON "UserLastSeen"("userId", "scopeKey");

CREATE INDEX "IstAdjustmentRequest_vklName_status_idx" ON "IstAdjustmentRequest"("vklName", "status");

CREATE INDEX "IstAdjustmentRequest_storeId_status_idx" ON "IstAdjustmentRequest"("storeId", "status");

CREATE INDEX "WeeklyVodOverride_storeId_monthLabel_idx" ON "WeeklyVodOverride"("storeId", "monthLabel");

CREATE UNIQUE INDEX "WeeklyVodOverride_storeId_metric_monthLabel_weekIndex_key" ON "WeeklyVodOverride"("storeId", "metric", "monthLabel", "weekIndex");`;
