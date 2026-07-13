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
  sta_nam_kor: string;
  surface: number | null;
  mid: number | null;
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
    const mid = byLayer("2");
    const bottom = byLayer("3") ?? mid;
    return {
      sta_cde: first.sta_cde,
      region: first.region,
      sta_nam_kor: first.sta_nam_kor,
      surface,
      mid,
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
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        표층-저층 온도차가 클수록 층이 섞이지 않는 성층화가 진행 중일 가능성이 높습니다
        (아래 경고 기준은 공식 수치가 아닌 잠정 휴리스틱입니다).
      </p>

      <div
        className="overflow-hidden overflow-x-auto rounded-lg border"
        style={{ borderColor: "var(--border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs font-semibold uppercase tracking-wide"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              <th className="p-3">지역</th>
              <th className="p-3">관측소</th>
              <th className="p-3 text-right">표층(℃)</th>
              <th className="p-3 text-right">중층(℃)</th>
              <th className="p-3 text-right">저층(℃)</th>
              <th className="p-3 text-right">표층-저층 온도차</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => {
              const warn = s.diff !== null && s.diff >= STRATIFICATION_WARNING_DIFF;
              return (
                <tr key={s.sta_cde} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="p-3 font-medium">{s.region}</td>
                  <td className="p-3">{s.sta_nam_kor}</td>
                  <td className="p-3 text-right tabular-nums">{s.surface?.toFixed(1) ?? "-"}</td>
                  <td className="p-3 text-right tabular-nums">{s.mid?.toFixed(1) ?? "-"}</td>
                  <td className="p-3 text-right tabular-nums">{s.bottom?.toFixed(1) ?? "-"}</td>
                  <td className="p-3 text-right">
                    {s.diff !== null ? (
                      <span
                        className="inline-flex items-center gap-1.5 font-semibold tabular-nums"
                        style={{ color: warn ? "var(--serious)" : "var(--text-primary)" }}
                      >
                        {warn && <AlertTriangle size={14} />}
                        {s.diff.toFixed(1)}℃
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>데이터 없음</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
