begin;

create table if not exists "Store" (
  "id" text primary key,
  "name" text not null,
  "gfName" text,
  "vklName" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "User" (
  "id" text primary key,
  "email" text not null,
  "name" text,
  "role" text not null,
  "gfName" text,
  "vklName" text,
  "primaryStoreId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "User_primaryStoreId_fkey"
    foreign key ("primaryStoreId") references "Store"("id")
    on delete set null on update cascade
);

create table if not exists "Metric" (
  "code" text primary key,
  "displayName" text not null,
  "unit" text,
  "aggregation" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "Month" (
  "id" text primary key,
  "label" text not null,
  "year" integer not null,
  "monthNumber" integer not null,
  "businessYear" integer not null,
  "businessOrder" integer not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "ImportBatch" (
  "id" text primary key,
  "source" text not null,
  "fileName" text not null,
  "uploadedBy" text,
  "status" text not null default 'completed',
  "rowCount" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "monthId" text,
  constraint "ImportBatch_monthId_fkey"
    foreign key ("monthId") references "Month"("id")
    on delete set null on update cascade
);

create table if not exists "MonthlyValue" (
  "id" text primary key,
  "source" text not null,
  "storeId" text not null,
  "metricCode" text not null,
  "monthId" text not null,
  "value" double precision not null,
  "present" boolean not null default true,
  "importedAt" timestamptz not null default now(),
  "importBatchId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "MonthlyValue_importBatchId_fkey"
    foreign key ("importBatchId") references "ImportBatch"("id")
    on delete set null on update cascade,
  constraint "MonthlyValue_metricCode_fkey"
    foreign key ("metricCode") references "Metric"("code")
    on delete restrict on update cascade,
  constraint "MonthlyValue_monthId_fkey"
    foreign key ("monthId") references "Month"("id")
    on delete restrict on update cascade,
  constraint "MonthlyValue_storeId_fkey"
    foreign key ("storeId") references "Store"("id")
    on delete restrict on update cascade
);

create table if not exists "DashboardNote" (
  "id" text primary key,
  "scopeKey" text not null,
  "scopeType" text not null,
  "scopeId" text not null,
  "scopeLabel" text not null,
  "metricKey" text not null,
  "role" text not null,
  "author" text not null,
  "text" text not null,
  "storeId" text,
  "updatedAt" timestamptz not null default now(),
  "createdAt" timestamptz not null default now(),
  constraint "DashboardNote_storeId_fkey"
    foreign key ("storeId") references "Store"("id")
    on delete set null on update cascade
);

create table if not exists "WeeklyVodOverride" (
  "id" text primary key,
  "storeId" text not null,
  "metric" text not null,
  "monthLabel" text not null,
  "weekIndex" integer not null,
  "weekLabel" text not null,
  "rangeLabel" text not null,
  "value" double precision not null,
  "distributionMode" text,
  "updatedAt" timestamptz not null default now(),
  "updatedBy" text not null,
  "createdAt" timestamptz not null default now(),
  constraint "WeeklyVodOverride_storeId_fkey"
    foreign key ("storeId") references "Store"("id")
    on delete restrict on update cascade
);

create unique index if not exists "User_email_key" on "User" ("email");
create index if not exists "MonthlyValue_storeId_monthId_idx" on "MonthlyValue" ("storeId", "monthId");
create index if not exists "MonthlyValue_monthId_source_idx" on "MonthlyValue" ("monthId", "source");
create unique index if not exists "MonthlyValue_source_storeId_metricCode_monthId_key" on "MonthlyValue" ("source", "storeId", "metricCode", "monthId");
create unique index if not exists "DashboardNote_scopeKey_role_metricKey_key" on "DashboardNote" ("scopeKey", "role", "metricKey");
create index if not exists "DashboardNote_scopeKey_metricKey_idx" on "DashboardNote" ("scopeKey", "metricKey");
create unique index if not exists "WeeklyVodOverride_storeId_metric_monthLabel_weekIndex_key" on "WeeklyVodOverride" ("storeId", "metric", "monthLabel", "weekIndex");
create index if not exists "WeeklyVodOverride_storeId_monthLabel_idx" on "WeeklyVodOverride" ("storeId", "monthLabel");

commit;
