export type MetricFormat = 'currency' | 'hours' | 'number' | 'fte';

export type DashboardUser = {
  role: string;
  displayName: string;
  email?: string;
  gfName?: string;
  vklName?: string;
  primaryStoreId?: string;
};

export type DashboardScope = {
  id: string;
  label: string;
  type: 'STORE' | 'AGGREGATE' | string;
  storeIds: string[];
  noteScopeKey?: string;
};

export type DashboardScopeOption = {
  id: string;
  label: string;
  type: 'STORE' | 'AGGREGATE' | string;
};

export type WorkforceStructureBandValue = {
  key: string;
  label: string;
  fteWeight: number;
  hoursWeight: number;
  count: number;
  planCount?: number;
  realCount?: number;
  hasRealCount?: boolean;
};

export type WorkforceStructureMixValue = {
  bands: WorkforceStructureBandValue[];
  totalAdjustment: number;
  planTotalAdjustment?: number;
  realTotalAdjustment?: number | null;
  hasRealMix?: boolean;
  hasAnyData?: boolean;
  isStructureMix: boolean;
};

export type MetricRow = {
  type: string;
  label: string;
  values: Array<number | null | WorkforceStructureMixValue>;
  total?: number | string;
  actualValues?: number[];
  actualTotal?: number;
  hasRealFlags?: boolean[];
  closed?: boolean[];
  displayFormat?: MetricFormat;
};

export type MetricSection = {
  metric: string;
  format: MetricFormat;
  rows: MetricRow[];
  breakdown?: Array<{
    storeId: string;
    storeName: string;
    displayLabel?: string;
    rows: MetricRow[];
    breakdown?: Array<{
      storeId: string;
      storeName: string;
      displayLabel?: string;
      rows: MetricRow[];
    }>;
  }>;
};

export type DashboardCard = {
  metric: string;
  value: number;
  format: MetricFormat;
  detailLabel?: string;
  detailLeft?: number;
  detailRight?: number;
  variance?: number;
  variancePct?: number;
};

export type ChartSeries = {
  labels: string[];
  plan: number[];
  forecast: number[];
  real: number[];
  adjustment?: number[];
  realFlags?: boolean[];
};

export type DashboardCharts = {
  obrat: ChartSeries;
  hours: ChartSeries;
  performance: ChartSeries;
  workforce?: ChartSeries;
};

export type StoreSummaryItem = {
  id: string;
  label: string;
  turnover?: number;
  hours?: number;
  performance?: number;
};

export type DashboardPayload = {
  generatedAt: string;
  user: DashboardUser;
  scope: DashboardScope;
  scopes: DashboardScopeOption[];
  months: string[];
  cards: DashboardCard[];
  charts: DashboardCharts;
  table: MetricSection[];
  stores: StoreSummaryItem[];
};

export type SummaryMetricRow = {
  type: string;
  label: string;
  values: number[];
  total?: number;
  actualValues?: number[];
  actualTotal?: number;
  hasRealFlags?: boolean[];
};

export type SummaryMetric = {
  metric: string;
  format: MetricFormat;
  rows: SummaryMetricRow[];
};

export type SummaryNode = {
  id: string;
  type: 'GLOBAL' | 'GF' | 'VKL' | 'STORE' | string;
  label: string;
  parentId?: string;
  childIds: string[];
  storeCount: number;
  metrics: SummaryMetric[];
  charts?: {
    turnover?: ChartSeries;
    hours?: ChartSeries;
    performance?: ChartSeries;
  };
};

export type SummaryHierarchy = {
  rootId: string;
  nodes: Record<string, SummaryNode>;
};

export type SummaryUser = {
  role: string;
  displayName: string;
  email?: string;
} | null;

export type SummaryPayload = {
  generatedAt: string;
  user: SummaryUser;
  gfCount: number;
  vklCount: number;
  storeCount: number;
  months: string[];
  metrics: string[];
  hierarchy: SummaryHierarchy;
  defaultNodeId: string;
  defaultMonth?: string;
};

export type WeeklyOverrideSeries = {
  values: number[];
  distributionMode?: string;
};

export type WeeklyOverridesPayload = {
  scopeId: string;
  month: string;
  overrides: Record<string, WeeklyOverrideSeries>;
  storeOverrides: Record<string, Record<string, WeeklyOverrideSeries>>;
};
