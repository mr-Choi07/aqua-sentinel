import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import MetricsBar from "./components/MetricsBar";
import RiskTab from "./components/RiskTab";
import TemperatureTab from "./components/TemperatureTab";
import RedtideTab from "./components/RedtideTab";
import CoachTab from "./components/CoachTab";
import ReportTab from "./components/ReportTab";
import {
  fetchSpecies,
  fetchTemperature,
  fetchRisk,
  fetchRedtide,
  type TemperatureReading,
  type RiskResult,
  type RedtideBulletin,
} from "./api";

const TABS = [
  { label: "위험도 현황", icon: "📊" },
  { label: "수온 상세", icon: "🌡️" },
  { label: "적조 속보", icon: "🌊" },
  { label: "AI 대응 코치", icon: "🤖" },
  { label: "피해 신고서", icon: "📄" },
] as const;
type Tab = (typeof TABS)[number]["label"];

export default function App() {
  const [species, setSpecies] = useState<string[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState("일반(기본)");
  const [activeTab, setActiveTab] = useState<Tab>("위험도 현황");

  const [temperature, setTemperature] = useState<TemperatureReading[]>([]);
  const [risk, setRisk] = useState<RiskResult[]>([]);
  const [redtide, setRedtide] = useState<RedtideBulletin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpecies()
      .then((list) => {
        setSpecies(list);
        if (!list.includes(selectedSpecies)) setSelectedSpecies(list[0] ?? "일반(기본)");
      })
      .catch((e) => setError(String(e)));
    fetchTemperature().then(setTemperature).catch((e) => setError(String(e)));
    fetchRedtide().then(setRedtide).catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRisk(selectedSpecies).then(setRisk).catch((e) => setError(String(e)));
  }, [selectedSpecies]);

  const surfaceReadings = temperature.filter((t) => t.obs_lay_label === "표층");
  const avgSurfaceTemp =
    surfaceReadings.length > 0
      ? surfaceReadings.reduce((sum, t) => sum + t.wtr_tmp, 0) / surfaceReadings.length
      : null;
  const alertCount =
    risk.length > 0 ? risk.filter((r) => r.level === "주의" || r.level === "경보").length : null;
  const stationCount = new Set(temperature.map((t) => t.sta_cde)).size;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--page)" }}>
      <Sidebar species={species} selectedSpecies={selectedSpecies} onSelectSpecies={setSelectedSpecies} />

      <main className="flex-1 p-8">
        <header className="mb-6">
          <h2 className="text-2xl font-bold">{activeTab}</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            통영·거제·남해·고성 관측소 기준 실시간 데이터
          </p>
        </header>

        {error && (
          <p
            className="mb-4 rounded-lg p-3 text-sm"
            style={{ background: "rgba(208,59,59,0.1)", color: "var(--critical)" }}
          >
            {error}
          </p>
        )}

        <MetricsBar stationCount={stationCount} avgSurfaceTemp={avgSurfaceTemp} alertCount={alertCount} />

        <nav
          className="my-6 flex w-fit gap-1 rounded-xl p-1"
          style={{ background: "var(--surface-2)" }}
        >
          {TABS.map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={
                activeTab === label
                  ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div
          className="rounded-xl p-6"
          style={{ background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}
        >
          {activeTab === "위험도 현황" && <RiskTab data={risk} />}
          {activeTab === "수온 상세" && <TemperatureTab data={temperature} />}
          {activeTab === "적조 속보" && <RedtideTab data={redtide} />}
          {activeTab === "AI 대응 코치" && <CoachTab riskData={risk} species={selectedSpecies} />}
          {activeTab === "피해 신고서" && <ReportTab riskData={risk} species={selectedSpecies} />}
        </div>
      </main>
    </div>
  );
}
