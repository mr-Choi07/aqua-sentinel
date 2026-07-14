import { ArrowLeft, Check } from "lucide-react";
import type { RiskResult } from "../api";
import Badge from "./Badge";

interface Props {
  species: string[];
  selectedSpecies: string;
  onSelectSpecies: (s: string) => void;
  stations: RiskResult[];
  selectedStation: string;
  onSelectStation: (sta_cde: string) => void;
  onBack: () => void;
}

export default function StationPicker({
  species,
  selectedSpecies,
  onSelectSpecies,
  stations,
  selectedStation,
  onSelectStation,
  onBack,
}: Props) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6">
      <button
        onClick={onBack}
        className="tap-target flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-lg font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        <ArrowLeft size={24} />
        홈으로
      </button>

      <div>
        <p className="mb-2 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
          양식 어종
        </p>
        <div className="flex flex-wrap gap-2">
          {species.map((s) => (
            <button
              key={s}
              onClick={() => onSelectSpecies(s)}
              className="tap-target rounded-full px-4 py-2 text-base font-bold"
              style={
                s === selectedSpecies
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--surface-2)", color: "var(--text-secondary)" }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          내 어장을 골라주세요
        </p>
        <div className="flex flex-col gap-2.5">
          {stations.map((s) => {
            const active = s.sta_cde === selectedStation;
            return (
              <button
                key={s.sta_cde}
                onClick={() => onSelectStation(s.sta_cde)}
                className="tap-target flex items-center gap-3 rounded-2xl px-5 py-4 text-left"
                style={{
                  background: active ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "var(--surface)",
                  border: active ? "2px solid var(--accent)" : "2px solid transparent",
                  boxShadow: "var(--shadow-sm)",
                  minHeight: 56,
                }}
              >
                <span className="flex-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {s.region}
                </span>
                <Badge level={s.level} />
                {active && <Check size={22} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
