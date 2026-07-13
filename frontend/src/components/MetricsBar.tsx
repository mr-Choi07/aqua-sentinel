interface Props {
  stationCount: number;
  avgSurfaceTemp: number | null;
  alertCount: number | null;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function MetricsBar({ stationCount, avgSurfaceTemp, alertCount }: Props) {
  return (
    <div className="flex gap-4">
      <MetricCard label="모니터링 관측소" value={String(stationCount)} />
      <MetricCard
        label="표층 평균 수온"
        value={avgSurfaceTemp !== null ? `${avgSurfaceTemp.toFixed(1)} ℃` : "-"}
      />
      <MetricCard
        label="주의·경보 단계 어장"
        value={alertCount !== null ? String(alertCount) : "-"}
      />
    </div>
  );
}
