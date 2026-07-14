import { Bot, ChevronRight, FileText, MapPin, Search } from "lucide-react";
import type { RiskResult } from "../api";
import { statusOf, statusSentence } from "../lib/status";

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
}: {
  icon: typeof Bot;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex w-full items-center gap-4 rounded-2xl px-6 py-5 text-left transition-transform active:scale-[0.98]"
      style={{ background: "var(--surface)", boxShadow: "var(--shadow-md)", minHeight: 72 }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}
      >
        <Icon size={28} strokeWidth={2.5} />
      </div>
      <span className="flex-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      <ChevronRight size={26} style={{ color: "var(--text-muted)" }} />
    </button>
  );
}

export default function HomeScreen({ selectedRisk, onOpenStationPicker, onGoCoach, onGoReport, onGoMore }: Props) {
  const level = selectedRisk?.level ?? "데이터 부족";
  const status = statusOf(level);
  const sentence = statusSentence(level, selectedRisk?.current_temp ?? null);

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
        className="flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center"
        style={{ background: status.bg, minHeight: "40vh", justifyContent: "center" }}
      >
        <status.Icon size={88} strokeWidth={2} style={{ color: status.color }} />
        <p className="text-[40px] font-extrabold leading-tight" style={{ color: status.color }}>
          {status.label}
        </p>
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          {sentence}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <BigButton icon={Bot} label="무엇을 해야 하나요?" onClick={onGoCoach} />
        <BigButton icon={FileText} label="피해가 있어요" onClick={onGoReport} />
        <BigButton icon={Search} label="더 자세히 보기" onClick={onGoMore} />
      </div>
    </div>
  );
}
