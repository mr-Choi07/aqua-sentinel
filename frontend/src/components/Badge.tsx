const LEVEL_STYLES: Record<string, { color: string; icon: string }> = {
  경보: { color: "var(--critical)", icon: "●" },
  주의: { color: "var(--serious)", icon: "●" },
  관심: { color: "var(--warning)", icon: "●" },
  정상: { color: "var(--good)", icon: "●" },
  "데이터 부족": { color: "var(--text-muted)", icon: "○" },
};

export default function Badge({ level }: { level: string }) {
  const style = LEVEL_STYLES[level] ?? LEVEL_STYLES["데이터 부족"];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: `color-mix(in srgb, ${style.color} 14%, transparent)`,
        color: style.color,
      }}
    >
      <span>{style.icon}</span>
      {level}
    </span>
  );
}
