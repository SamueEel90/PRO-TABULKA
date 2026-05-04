-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gfName" TEXT,
    "vklName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "gfName" TEXT,
    "vklName" TEXT,
    "primaryStoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT,
    "aggregation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Month" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "businessYear" INTEGER NOT NULL,
    "businessOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Month_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthId" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyValue" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "metricCode" TEXT NOT NULL,
    "monthId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardNote" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "storeId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteComment" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "metricKey" TEXT,
    "monthLabel" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdByRole" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByName" TEXT,
    "completedAt" TIMESTAMP(3),
    "sourceCommentId" TEXT,

    CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metricKey" TEXT,
    "monthLabel" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLastSeen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLastSeen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyVodOverride" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "rangeLabel" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "distributionMode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyVodOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "MonthlyValue_storeId_monthId_idx" ON "MonthlyValue"("storeId", "monthId");

-- CreateIndex
CREATE INDEX "MonthlyValue_monthId_source_idx" ON "MonthlyValue"("monthId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyValue_source_storeId_metricCode_monthId_key" ON "MonthlyValue"("source", "storeId", "metricCode", "monthId");

-- CreateIndex
CREATE INDEX "DashboardNote_scopeKey_metricKey_idx" ON "DashboardNote"("scopeKey", "metricKey");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardNote_scopeKey_role_metricKey_key" ON "DashboardNote"("scopeKey", "role", "metricKey");

-- CreateIndex
CREATE INDEX "NoteComment_scopeKey_metricKey_createdAt_idx" ON "NoteComment"("scopeKey", "metricKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskItem_sourceCommentId_key" ON "TaskItem"("sourceCommentId");

-- CreateIndex
CREATE INDEX "TaskItem_scopeKey_status_idx" ON "TaskItem"("scopeKey", "status");

-- CreateIndex
CREATE INDEX "TaskItem_scopeKey_metricKey_idx" ON "TaskItem"("scopeKey", "metricKey");

-- CreateIndex
CREATE INDEX "ActivityEntry_scopeKey_createdAt_idx" ON "ActivityEntry"("scopeKey", "createdAt");

-- CreateIndex
CREATE INDEX "UserLastSeen_userId_idx" ON "UserLastSeen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLastSeen_userId_scopeKey_key" ON "UserLastSeen"("userId", "scopeKey");

-- CreateIndex
CREATE INDEX "WeeklyVodOverride_storeId_monthLabel_idx" ON "WeeklyVodOverride"("storeId", "monthLabel");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyVodOverride_storeId_metric_monthLabel_weekIndex_key" ON "WeeklyVodOverride"("storeId", "metric", "monthLabel", "weekIndex");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryStoreId_fkey" FOREIGN KEY ("primaryStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "Month"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyValue" ADD CONSTRAINT "MonthlyValue_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyValue" ADD CONSTRAINT "MonthlyValue_metricCode_fkey" FOREIGN KEY ("metricCode") REFERENCES "Metric"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyValue" ADD CONSTRAINT "MonthlyValue_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "Month"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyValue" ADD CONSTRAINT "MonthlyValue_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardNote" ADD CONSTRAINT "DashboardNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_sourceCommentId_fkey" FOREIGN KEY ("sourceCommentId") REFERENCES "NoteComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyVodOverride" ADD CONSTRAINT "WeeklyVodOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

