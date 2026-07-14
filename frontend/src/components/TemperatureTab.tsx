import { AlertTriangle } from "lucide-react";
import type { TemperatureReading } from "../api";

// 표층-저층 온도차가 크면 수온약층(성층화)이 형성되어 저층에 빈산소수괴가 생기기 쉽다는
// 일반적 해양학 개념은 맞지만, "몇 도 차이부터 위험"이라는 공인된 수치 기준은 찾지
// 못했다(TODO: 국립수산과학원 빈산소수괴 자료로 검증 필요). 아래 3℃는 그때까지 쓰는
// 잠정적 휴리스틱이며, 공식 기준이 아니다.
const STRATIFICATION_WARNING_DIFF = 3;

interface StationStratification {
  sta_cde: string;
  region: string;
  surface: number | null;
  bottom: number | null;
  diff: number | null;
}

function computeStratification(data: TemperatureReading[]): StationStratification[] {
  const byStation = new Map<string, TemperatureReading[]>();
  for (const r of data) {
    const list = byStation.get(r.sta_cde) ?? [];
    list.push(r);
    byStation.set(r.sta_cde, list);
  }

  return Array.from(byStation.values()).map((readings) => {
    const first = readings[0];
    const byLayer = (layer: string) => readings.find((r) => r.obs_lay === layer)?.wtr_tmp ?? null;
    const surface = byLayer("1");
    const bottom = byLayer("3") ?? byLayer("2");
    return {
      sta_cde: first.sta_cde,
      region: first.region,
      surface,
      bottom,
      diff: surface !== null && bottom !== null ? surface - bottom : null,
    };
  });
}

export default function TemperatureTab({ data }: { data: TemperatureReading[] }) {
  if (data.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>수온 데이터가 없습니다.</p>;
  }

  const stations = computeStratification(data).sort(
    (a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity)
  );

  return (
    <div className="flex flex-col gap-2.5">
      {stations.map((s) => {
        const warn = s.diff !== null && s.diff >= STRATIFICATION_WARNING_DIFF;
        return (
          <div
            key={s.sta_cde}
            className="rounded-2xl p-4"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {s.region}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              물 위 {s.surface?.toFixed(1) ?? "-"}°C · 물 아래 {s.bottom?.toFixed(1) ?? "-"}°C
            </p>
            {s.diff !== null ? (
              warn ? (
                <p
                  className="mt-2 flex items-center gap-1.5 text-base font-bold"
                  style={{ color: "var(--warning)" }}
                >
                  <AlertTriangle size={18} />
                  물 위아래 온도 차이가 커서 아래쪽 산소가 부족해질 수 있어요
                </p>
              ) : (
                <p className="mt-2 text-base font-semibold" style={{ color: "var(--good)" }}>
                  물 위아래 온도 차이가 크지 않아요
                </p>
              )
            ) : (
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                데이터가 부족해요
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
