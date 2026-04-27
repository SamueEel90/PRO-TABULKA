type SparklineProps = {
  values: number[];
  stroke?: string;
  fill?: string;
  height?: number;
};

export function Sparkline({ values, stroke = '#174a75', fill = 'rgba(23, 74, 117, 0.14)', height = 88 }: SparklineProps) {
  const width = 320;
  const safeValues = values.length ? values : [0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;

  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? width / 2 : (index / (safeValues.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={areaPoints} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type BarChartProps = {
  values: number[];
  labels: string[];
  tone?: 'brand' | 'teal' | 'amber';
};

export function BarChart({ values, labels, tone = 'brand' }: BarChartProps) {
  const max = Math.max(...values, 0) || 1;

  return (
    <div className={`bar-chart bar-chart--${tone}`}>
      {values.map((value, index) => (
        <div className="bar-chart-item" key={`${labels[index]}-${index}`}>
          <div className="bar-chart-value">{Math.round((value / max) * 100)}%</div>
          <div className="bar-chart-track">
            <div className="bar-chart-fill" style={{ height: `${Math.max((value / max) * 100, 4)}%` }} />
          </div>
          <div className="bar-chart-label">{labels[index]?.slice(0, 3)}</div>
        </div>
      ))}
    </div>
  );
}
