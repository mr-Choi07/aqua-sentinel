import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, MapPin } from "lucide-react";
import type { Farm } from "../api";
import { createFarm } from "../api";

interface Props {
  species: string[];
  onRegistered: (farm: Farm) => void;
  onBack: () => void;
}

export default function FarmRegister({ species, onRegistered, onBack }: Props) {
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState(species[0] ?? "일반(기본)");
  const [stockingInfo, setStockingInfo] = useState("");

  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<Farm | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("이 브라우저는 위치 확인을 지원하지 않아요.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        setLocateError(err.message || "위치를 확인하지 못했어요. 직접 입력해주세요.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!name.trim()) {
      setSubmitError("어장 이름을 입력해주세요.");
      return;
    }
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      setSubmitError("위도·경도를 숫자로 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const farm = await createFarm({
        name: name.trim(),
        lat: latNum,
        lon: lonNum,
        species: selectedSpecies,
        stocking_info: stockingInfo.trim(),
      });
      setResult(farm);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border px-4 py-3 text-lg";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" };
  const labelClass = "block text-lg font-bold mb-2";

  if (result) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
          어장이 등록됐어요
        </h2>

        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {result.name}
          </p>
          <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
            가장 가까운 관측소: <strong>{result.region}</strong> (약 {result.distance_km}km)
          </p>
          {result.far_match && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl p-3 text-sm"
              style={{ background: "color-mix(in srgb, var(--warning) 16%, transparent)", color: "var(--warning)" }}
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>
                가장 가까운 관측소도 {result.distance_km}km나 떨어져 있어요. 근처에 관측소가
                부족한 지역이라, 이 관측소 수온이 실제 어장 상황과 다를 수 있어요.
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => onRegistered(result)}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)", minHeight: 56 }}
        >
          <CheckCircle2 size={22} />
          이 어장으로 시작하기
        </button>
      </div>
    );
  }

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
        내 어장 등록하기
      </h2>
      <p className="text-base" style={{ color: "var(--text-secondary)" }}>
        위치를 등록하면 가장 가까운 관측소를 자동으로 연결해드려요.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClass}>어장 이름</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 우리집 어장"
          />
        </div>

        <div>
          <label className={labelClass}>어장 위치</label>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="tap-target mb-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold disabled:opacity-50"
            style={{ background: "var(--surface-2)", color: "var(--accent)" }}
          >
            {locating ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}
            {locating ? "위치 확인하는 중..." : "내 위치 사용하기"}
          </button>
          {locateError && (
            <p className="mb-2 text-sm font-semibold" style={{ color: "var(--critical)" }}>
              {locateError}
            </p>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              style={inputStyle}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="위도 (예: 34.8544)"
              inputMode="decimal"
            />
            <input
              className={inputClass}
              style={inputStyle}
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="경도 (예: 128.4331)"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            양식 어종
          </p>
          <div className="flex flex-wrap gap-2">
            {species.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSpecies(s)}
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
          <label className={labelClass}>입식량 (선택)</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={stockingInfo}
            onChange={(e) => setStockingInfo(e.target.value)}
            placeholder="예: 5,000마리, 200줄 등"
          />
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            나중에 피해 규모를 가늠하는 참고 정보로만 사용해요.
          </p>
        </div>

        {submitError && (
          <p className="text-lg font-semibold" style={{ color: "var(--critical)" }}>
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-lg font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", boxShadow: "var(--shadow-sm)", minHeight: 56 }}
        >
          {submitting && <Loader2 size={20} className="animate-spin" />}
          {submitting ? "등록하는 중..." : "등록하기"}
        </button>
      </form>
    </div>
  );
}
