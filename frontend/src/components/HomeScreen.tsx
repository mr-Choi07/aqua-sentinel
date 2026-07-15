import { ChevronRight, FileText, MapPin, MessageCircle, Waves } from "lucide-react";
import type { RiskResult } from "../api";
import { coachButtonHint, formatObservedAt, statusOf, statusSentence, trendSentence } from "../lib/status";

interface Props {
  selectedRisk: RiskResult | null;
  onOpenStationPicker: () => void;
  onGoCoach: () => void;
  onGoReport: () => void;
  onGoMore: () => void;
}

function BigButton({
  icon: Icon,
  label,
  onClick,
  hint,
  accentColor,
}: {
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
  hint?: { text: string; color: string } | null;
  accentColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex w-full items-center gap-4 rounded-2xl px-6 py-5 text-left transition-transform active:scale-[0.98]"
      style={{
        background: "var(--surface)",
        boxShadow: "var(--shadow-md)",
        minHeight: 72,
        borderLeft: accentColor ? `5px solid ${accentColor}` : "5px solid transparent",
      }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}
      >
        <Icon size={28} strokeWidth={2.5} />
      </div>
      <span className="flex-1">
        <span className="block text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-sm font-semibold" style={{ color: hint.color }}>
            {hint.text}
          </span>
        )}
      </span>
      <ChevronRight size={26} style={{ color: "var(--text-muted)" }} />
    </button>
  );
}

export default function HomeScreen({ selectedRisk, onOpenStationPicker, onGoCoach, onGoReport, onGoMore }: Props) {
  const level = selectedRisk?.level ?? "데이터 부족";
  const status = statusOf(level);
  const sentence = statusSentence(level, selectedRisk?.current_temp ?? null);
  const trend = selectedRisk
    ? trendSentence(selectedRisk.day_over_day_delta, selectedRisk.rising_streak_days)
    : null;
  const observedLabel = selectedRisk ? formatObservedAt(selectedRisk.observed_at) : null;

  const hint = coachButtonHint(level);
  const emphasizeCoach = level === "주의" || level === "경보";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <h1 className="text-[28px] font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
        어장지킴이
      </h1>

      <button
        onClick={onOpenStationPicker}
        className="tap-target flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)", minHeight: 56 }}
      >
        <MapPin size={22} style={{ color: "var(--accent)" }} />
        <span className="flex-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
          {selectedRisk ? selectedRisk.region : "어장을 선택해주세요"}
        </span>
        <ChevronRight size={22} style={{ color: "var(--text-muted)" }} />
      </button>

      <div
        className="flex flex-col items-center gap-2 rounded-3xl px-6 py-10 text-center"
        style={{ background: status.bg, minHeight: "40vh", justifyContent: "center" }}
      >
        <status.Icon size={88} strokeWidth={2} style={{ color: status.color }} />
        <p className="text-[40px] font-extrabold leading-tight" style={{ color: status.color }}>
          {status.label}
        </p>
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {sentence}
        </p>
        {trend && (
          <p className="text-base font-bold" style={{ color: "var(--text-secondary)" }}>
            {trend}
          </p>
        )}
        {observedLabel && (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {observedLabel}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <BigButton
          icon={MessageCircle}
          label="무엇을 해야 하나요?"
          onClick={onGoCoach}
          hint={hint}
          accentColor={emphasizeCoach ? status.color : undefined}
        />
        <BigButton icon={FileText} label="피해가 있어요" onClick={onGoReport} />
        <BigButton icon={Waves} label="수온·적조 자세히 보기" onClick={onGoMore} />
      </div>
    </div>
  );
}
