import { useEffect, useState } from "react";
import HomeScreen from "./components/HomeScreen";
import StationPicker from "./components/StationPicker";
import CoachTab from "./components/CoachTab";
import ReportTab from "./components/ReportTab";
import MoreScreen from "./components/MoreScreen";
import {
  fetchSpecies,
  fetchTemperature,
  fetchRisk,
  fetchRedtide,
  type TemperatureReading,
  type RiskResult,
  type RedtideBulletin,
} from "./api";

type View = "home" | "station-picker" | "coach" | "report" | "more";

export default function App() {
  const [species, setSpecies] = useState<string[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState("일반(기본)");
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [view, setView] = useState<View>("home");

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
    fetchRisk(selectedSpecies)
      .then((list) => {
        setRisk(list);
        if (!selectedStation && list.length > 0) setSelectedStation(list[0].sta_cde);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpecies]);

  const selectedRisk = risk.find((r) => r.sta_cde === selectedStation) ?? null;
  const goHome = () => setView("home");

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      {error && (
        <p
          className="mx-auto mb-2 max-w-xl rounded-2xl p-4 text-lg font-semibold"
          style={{ background: "color-mix(in srgb, var(--critical) 14%, transparent)", color: "var(--critical)" }}
        >
          {error}
        </p>
      )}

      {view === "home" && (
        <HomeScreen
          selectedRisk={selectedRisk}
          onOpenStationPicker={() => setView("station-picker")}
          onGoCoach={() => setView("coach")}
          onGoReport={() => setView("report")}
          onGoMore={() => setView("more")}
        />
      )}

      {view === "station-picker" && (
        <StationPicker
          species={species}
          selectedSpecies={selectedSpecies}
          onSelectSpecies={setSelectedSpecies}
          stations={risk}
          selectedStation={selectedStation}
          onSelectStation={(sta_cde) => {
            setSelectedStation(sta_cde);
            goHome();
          }}
          onBack={goHome}
        />
      )}

      {view === "coach" && (
        <CoachTab selectedRisk={selectedRisk} species={selectedSpecies} onBack={goHome} />
      )}

      {view === "report" && (
        <ReportTab selectedRisk={selectedRisk} species={selectedSpecies} onBack={goHome} />
      )}

      {view === "more" && (
        <MoreScreen
          risk={risk}
          temperature={temperature}
          redtide={redtide}
          selectedStation={selectedStation}
          onBack={goHome}
        />
      )}
    </div>
  );
}
