interface Props {
  stationCount: number;
  avgSurfaceTemp: number | null;
  alertCount: number | null;
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="flex flex-1 items-center gap-4 rounded-xl p-5"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl"
        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export default function MetricsBar({ stationCount, avgSurfaceTemp, alertCount }: Props) {
  return (
    <div className="flex gap-4">
      <MetricCard icon="📡" label="모니터링 관측소" value={String(stationCount)} accent="var(--accent)" />
      <MetricCard
        icon="🌡️"
        label="표층 평균 수온"
        value={avgSurfaceTemp !== null ? `${avgSurfaceTemp.toFixed(1)} ℃` : "-"}
        accent="var(--accent-2)"
      />
      <MetricCard
        icon="⚠️"
        label="주의·경보 단계 어장"
        value={alertCount !== null ? String(alertCount) : "-"}
        accent={alertCount && alertCount > 0 ? "var(--critical)" : "var(--good)"}
      />
    </div>
  );
}
