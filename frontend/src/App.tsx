import { useEffect, useState } from "react";
import HomeScreen from "./components/HomeScreen";
import StationPicker from "./components/StationPicker";
import FarmRegister from "./components/FarmRegister";
import CoachTab from "./components/CoachTab";
import ReportTab from "./components/ReportTab";
import MoreScreen from "./components/MoreScreen";
import {
  fetchSpecies,
  fetchTemperature,
  fetchRisk,
  fetchRedtide,
  fetchFarm,
  type TemperatureReading,
  type RiskResult,
  type RedtideBulletin,
  type Farm,
} from "./api";
import { clearSavedFarmId, getSavedFarmId, saveFarmId } from "./lib/farm";

type View = "home" | "station-picker" | "farm-register" | "coach" | "report" | "more";

export default function App() {
  const [species, setSpecies] = useState<string[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState("일반(기본)");
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [view, setView] = useState<View>("home");
  const [registeredFarm, setRegisteredFarm] = useState<Farm | null>(null);

  const [temperature, setTemperature] = useState<TemperatureReading[]>([]);
  const [risk, setRisk] = useState<RiskResult[]>([]);
  const [redtide, setRedtide] = useState<RedtideBulletin[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 등록된 어장이 있는지부터 먼저 확인한 다음에 위험도 조회를 시작해야 한다.
  // 예전에는 두 요청을 동시에 날렸는데, "기본 어종으로 조회한 위험도" 응답이
  // 어장 정보 응답보다 늦게 도착하면 그 콜백이 예전 selectedStation("")을
  // 그대로 캡처하고 있어서 이미 적용된 내 어장 선택을 다시 덮어써버리는
  // 경쟁 상태가 있었다. 이 플래그로 순서를 강제해서 그 경쟁 자체를 없앤다.
  const [farmCheckDone, setFarmCheckDone] = useState(false);

  useEffect(() => {
    fetchSpecies()
      .then((list) => {
        setSpecies(list);
        if (!list.includes(selectedSpecies)) setSelectedSpecies(list[0] ?? "일반(기본)");
      })
      .catch((e) => setError(String(e)));
    fetchTemperature().then(setTemperature).catch((e) => setError(String(e)));
    fetchRedtide().then(setRedtide).catch((e) => setError(String(e)));

    // 이전에 등록해둔 어장이 있으면 그 어장의 관측소·어종을 기본값으로 쓴다.
    const savedId = getSavedFarmId();
    if (!savedId) {
      setFarmCheckDone(true);
      return;
    }
    fetchFarm(savedId)
      .then((farm) => {
        setRegisteredFarm(farm);
        setSelectedStation(farm.sta_cde);
        setSelectedSpecies(farm.species);
      })
      .catch(() => clearSavedFarmId()) // 등록된 어장을 못 찾으면(초기화 등) 정리
      .finally(() => setFarmCheckDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!farmCheckDone) return;
    fetchRisk(selectedSpecies)
      .then((list) => {
        setRisk(list);
        if (!selectedStation && list.length > 0) setSelectedStation(list[0].sta_cde);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpecies, farmCheckDone]);

  const selectedRisk = risk.find((r) => r.sta_cde === selectedStation) ?? null;
  const goHome = () => setView("home");

  function handleFarmRegistered(farm: Farm) {
    setRegisteredFarm(farm);
    saveFarmId(farm.id);
    setSelectedStation(farm.sta_cde);
    setSelectedSpecies(farm.species);
    goHome();
  }

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
          registeredFarm={registeredFarm}
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
          registeredFarm={registeredFarm}
          onOpenFarmRegister={() => setView("farm-register")}
        />
      )}

      {view === "farm-register" && (
        <FarmRegister species={species} onRegistered={handleFarmRegistered} onBack={goHome} />
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
