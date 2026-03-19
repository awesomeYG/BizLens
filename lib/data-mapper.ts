import type { DashboardData } from "./types";

export const DEFAULT_DASHBOARD_DATA: DashboardData = {
  months: ["1月", "2月", "3月", "4月", "5月", "6月"],
  sales: [120, 200, 150, 280, 220, 300],
  profit: [40, 60, 55, 90, 70, 100],
  channels: [
    { value: 335, name: "线上" },
    { value: 234, name: "线下" },
    { value: 135, name: "代理" },
  ],
  regions: ["华东", "华南", "华北", "西南", "西北"],
  regionSales: [320, 280, 200, 150, 80],
  totalSales: 1280,
  growth: 23.5,
  customers: 1256,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const num = Number(String(value).replace(/[,\s]+/g, ""));
  return Number.isFinite(num) ? num : null;
}

function detectNumericColumns(
  columns: string[],
  sampleData: Record<string, string>[]
): string[] {
  return columns.filter((col) =>
    sampleData.some((row) => toNumber(row[col]) !== null)
  );
}

function detectCategoryColumn(
  columns: string[],
  sampleData: Record<string, string>[]
): string | null {
  const numeric = new Set(detectNumericColumns(columns, sampleData));
  const textCol = columns.find((col) => !numeric.has(col));
  return textCol ?? columns[0] ?? null;
}

function sliceValues(
  values: Array<string | number | null | undefined>,
  size = 6
): number[] {
  return values
    .map((v) => toNumber(v))
    .filter((v): v is number => v !== null)
    .slice(0, size);
}

export function mapSampleToDashboard(
  columns: string[] | undefined,
  sampleData: Record<string, string>[] | undefined
): DashboardData {
  if (!columns?.length || !sampleData?.length) {
    return { ...DEFAULT_DASHBOARD_DATA };
  }

  const numericCols = detectNumericColumns(columns, sampleData);
  const categoryCol = detectCategoryColumn(columns, sampleData);

  const categories = categoryCol
    ? sampleData
        .map((row) => row[categoryCol] || "")
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const primarySeries = numericCols[0]
    ? sliceValues(sampleData.map((row) => row[numericCols[0]]))
    : [];
  const secondarySeries = numericCols[1]
    ? sliceValues(sampleData.map((row) => row[numericCols[1]]))
    : primarySeries.map((v) => Number((v * 0.7).toFixed(2)));

  const sales = primarySeries.length ? primarySeries : DEFAULT_DASHBOARD_DATA.sales;
  const profit = secondarySeries.length ? secondarySeries : DEFAULT_DASHBOARD_DATA.profit;

  const totalSales = Number(
    sales.reduce((acc, cur) => acc + (toNumber(cur) || 0), 0).toFixed(2)
  );
  const growthBase = profit[0] ?? profit[profit.length - 1] ?? 1;
  const growthRaw =
    growthBase !== 0
      ? (((profit[profit.length - 1] ?? growthBase) - growthBase) / Math.abs(growthBase)) * 100
      : DEFAULT_DASHBOARD_DATA.growth;
  const growth = Number(growthRaw.toFixed(1));

  const customers = Math.max(
    DEFAULT_DASHBOARD_DATA.customers,
    Math.round(totalSales * 8)
  );

  const channels = (() => {
    if (!categoryCol) return DEFAULT_DASHBOARD_DATA.channels;
    const counts = new Map<string, number>();
    sampleData.forEach((row) => {
      const key = row[categoryCol];
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
    return entries.length ? entries : DEFAULT_DASHBOARD_DATA.channels;
  })();

  const regionSales = (() => {
    const values = numericCols[2]
      ? sliceValues(sampleData.map((row) => row[numericCols[2]]), 5)
      : [];
    if (values.length) return values;
    if (sales.length >= 5) return sales.slice(0, 5);
    return DEFAULT_DASHBOARD_DATA.regionSales;
  })();

  const regions = (() => {
    if (categoryCol) return categories.slice(0, regionSales.length);
    return DEFAULT_DASHBOARD_DATA.regions.slice(0, regionSales.length);
  })();

  return {
    months: categories.length ? categories.slice(0, sales.length) : DEFAULT_DASHBOARD_DATA.months,
    sales,
    profit,
    channels,
    regions,
    regionSales,
    totalSales,
    growth: Number.isFinite(growth) ? growth : DEFAULT_DASHBOARD_DATA.growth,
    customers,
  };
}

export function applyKpiEdits(
  data: DashboardData,
  edits: Partial<Pick<DashboardData, "totalSales" | "growth" | "customers">>
): DashboardData {
  return {
    ...data,
    ...edits,
  };
}
