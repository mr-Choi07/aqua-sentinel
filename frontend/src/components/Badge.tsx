import { statusOf } from "../lib/status";

export default function Badge({ level }: { level: string }) {
  const { color, bg, Icon } = statusOf(level);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold"
      style={{ background: bg, color }}
    >
      <Icon size={18} strokeWidth={2.5} />
      {level}
    </span>
  );
}
