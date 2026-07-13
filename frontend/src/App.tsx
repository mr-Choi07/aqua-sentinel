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

const TABS = ["위험도 현황", "수온 상세", "적조 속보", "AI 대응 코치", "피해 신고서"] as const;
type Tab = (typeof TABS)[number];

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
    <div className="flex min-h-screen">
      <Sidebar species={species} selectedSpecies={selectedSpecies} onSelectSpecies={setSelectedSpecies} />

      <main className="flex-1 p-6">
        {error && (
          <p className="mb-4 text-sm" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}

        <MetricsBar stationCount={stationCount} avgSurfaceTemp={avgSurfaceTemp} alertCount={alertCount} />

        <div className="my-6 border-b flex gap-1" style={{ borderColor: "var(--border)" }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 text-sm font-medium border-b-2 -mb-px"
              style={{
                borderColor: activeTab === tab ? "#2a78d6" : "transparent",
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "위험도 현황" && <RiskTab data={risk} />}
        {activeTab === "수온 상세" && <TemperatureTab data={temperature} />}
        {activeTab === "적조 속보" && <RedtideTab data={redtide} />}
        {activeTab === "AI 대응 코치" && <CoachTab riskData={risk} species={selectedSpecies} />}
        {activeTab === "피해 신고서" && <ReportTab riskData={risk} species={selectedSpecies} />}
      </main>
    </div>
  );
}
