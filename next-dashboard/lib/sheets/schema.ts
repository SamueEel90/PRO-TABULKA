/**
 * Sheets schema mapping.
 *
 * Each tab name + column order matches Prisma model. The Apps Script Web App
 * reads/writes via headers, so column order in `columns` is the authoritative
 * source for what the sheet looks like.
 *
 * `idColumn` is used by updateById / deleteById ops in Apps Script.
 */

export type SheetTabDef = {
  /** Sheet tab name (also used as table key) */
  tab: string;
  /** Ordered list of column headers — first row of the sheet */
  columns: readonly string[];
  /** Column used as primary key for update/delete ops */
  idColumn: string;
};

export const SHEET_TABS = {
  Store: {
    tab: 'Store',
    idColumn: 'id',
    columns: ['id', 'name', 'gfName', 'vklName', 'createdAt', 'updatedAt'],
  },
  User: {
    tab: 'User',
    idColumn: 'id',
    columns: [
      'id', 'email', 'passwordHash', 'name', 'role',
      'gfName', 'vklName', 'primaryStoreId', 'active',
      'lastLoginAt', 'createdAt', 'updatedAt',
    ],
  },
  Metric: {
    tab: 'Metric',
    idColumn: 'code',
    columns: ['code', 'displayName', 'unit', 'aggregation', 'createdAt', 'updatedAt'],
  },
  Month: {
    tab: 'Month',
    idColumn: 'id',
    columns: ['id', 'label', 'year', 'monthNumber', 'businessYear', 'businessOrder', 'createdAt', 'updatedAt'],
  },
  ImportBatch: {
    tab: 'ImportBatch',
    idColumn: 'id',
    columns: ['id', 'source', 'fileName', 'uploadedBy', 'status', 'rowCount', 'monthId', 'createdAt'],
  },
  MonthlyValue: {
    tab: 'MonthlyValue',
    idColumn: 'id',
    columns: [
      'id', 'source', 'storeId', 'metricCode', 'monthId',
      'value', 'present', 'importedAt', 'importBatchId',
      'createdAt', 'updatedAt',
    ],
  },
  DashboardNote: {
    tab: 'DashboardNote',
    idColumn: 'id',
    columns: [
      'id', 'scopeKey', 'scopeType', 'scopeId', 'scopeLabel',
      'metricKey', 'role', 'author', 'text', 'storeId',
      'createdAt', 'updatedAt',
    ],
  },
  NoteComment: {
    tab: 'NoteComment',
    idColumn: 'id',
    columns: ['id', 'scopeKey', 'metricKey', 'role', 'author', 'text', 'createdAt'],
  },
  TaskItem: {
    tab: 'TaskItem',
    idColumn: 'id',
    columns: [
      'id', 'scopeKey', 'metricKey', 'monthLabel', 'text', 'status',
      'createdByRole', 'createdByName', 'createdAt',
      'completedByName', 'completedAt', 'sourceCommentId',
    ],
  },
  ActivityEntry: {
    tab: 'ActivityEntry',
    idColumn: 'id',
    columns: ['id', 'scopeKey', 'actorRole', 'actorName', 'action', 'metricKey', 'monthLabel', 'detail', 'createdAt'],
  },
  UserLastSeen: {
    tab: 'UserLastSeen',
    idColumn: 'id',
    columns: ['id', 'userId', 'scopeKey', 'lastSeenAt'],
  },
  IstAdjustmentRequest: {
    tab: 'IstAdjustmentRequest',
    idColumn: 'id',
    columns: [
      'id', 'storeId', 'metricCode', 'monthId', 'monthLabel',
      'oldValue', 'newValue', 'reason', 'status',
      'requestedById', 'requestedByName', 'vklName',
      'decidedAt', 'decidedById', 'decidedByName', 'decisionNote',
      'createdAt', 'updatedAt',
    ],
  },
  WeeklyVodOverride: {
    tab: 'WeeklyVodOverride',
    idColumn: 'id',
    columns: [
      'id', 'storeId', 'metric', 'monthLabel', 'weekIndex', 'weekLabel',
      'rangeLabel', 'value', 'distributionMode',
      'updatedBy', 'createdAt', 'updatedAt',
    ],
  },
} as const satisfies Record<string, SheetTabDef>;

export type SheetTabName = keyof typeof SHEET_TABS;

export const ALL_TABS: readonly SheetTabDef[] = Object.values(SHEET_TABS);
