import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import type { RedtideBulletin, RiskResult, TemperatureReading } from "../api";
import RiskTab from "./RiskTab";
import TemperatureTab from "./TemperatureTab";
import RedtideTab from "./RedtideTab";

interface Props {
  risk: RiskResult[];
  temperature: TemperatureReading[];
  redtide: RedtideBulletin[];
  selectedStation: string;
  onBack: () => void;
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl" style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
      <button
        onClick={onToggle}
        className="tap-target flex w-full items-center justify-between px-5 py-4 text-left"
        style={{ minHeight: 56 }}
      >
        <span className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          {title}
        </span>
        {open ? (
          <ChevronUp size={24} style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronDown size={24} style={{ color: "var(--text-muted)" }} />
        )}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export default function MoreScreen({ risk, temperature, redtide, selectedStation, onBack }: Props) {
  const [openSection, setOpenSection] = useState<"risk" | "temp" | "redtide" | null>("risk");

  const toggle = (key: "risk" | "temp" | "redtide") =>
    setOpenSection((cur) => (cur === key ? null : key));

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <button
        onClick={onBack}
        className="tap-target flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        <ArrowLeft size={24} />
        홈으로
      </button>

      <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
        수온·적조 자세히 보기
      </h2>

      <Section title="다른 어장 상황 보기" open={openSection === "risk"} onToggle={() => toggle("risk")}>
        <RiskTab data={risk} />
      </Section>

      <Section title="물 위아래 온도 차이" open={openSection === "temp"} onToggle={() => toggle("temp")}>
        <TemperatureTab data={temperature} />
      </Section>

      <Section title="적조 속보" open={openSection === "redtide"} onToggle={() => toggle("redtide")}>
        <RedtideTab data={redtide} stations={risk} selectedStation={selectedStation} />
      </Section>
    </div>
  );
}
