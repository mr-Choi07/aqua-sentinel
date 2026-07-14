import type { RedtideBulletin, RiskResult } from "../api";

interface Props {
  data: RedtideBulletin[];
  stations: RiskResult[];
  selectedStation: string;
}

// 통영시 관할 읍·면 지명은 적조속보 원문에 "통영" 대신 이렇게 표기되는 경우가 있어
// (예: "산양읍 장군봉 내만") 시군명만으로 매칭하면 놓친다. 알고 있는 관측소 지명은
// 문자열 일치로 함께 매칭한다. 위경도 기반 정밀 반경 계산이 아닌 텍스트 근사치다.
const EXTRA_ALIASES: Record<string, string[]> = {
  통영: ["산양읍", "장군봉"],
};

function cityOf(region: string): string {
  return region.split(" ")[0];
}

function buildAliasMap(stations: RiskResult[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of stations) {
    const [city, ...rest] = s.region.split(" ");
    map[city] ??= [city];
    if (rest.length > 0) map[city].push(rest.join(" "));
  }
  for (const [city, extra] of Object.entries(EXTRA_ALIASES)) {
    map[city] = [...(map[city] ?? [city]), ...extra];
  }
  return map;
}

function ImpactBadge({ affected }: { affected: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
      style={{
        background: affected
          ? "color-mix(in srgb, var(--critical) 16%, transparent)"
          : "color-mix(in srgb, var(--neutral) 16%, transparent)",
        color: affected ? "var(--critical)" : "var(--text-secondary)",
      }}
    >
      {affected ? "내 어장 영향 있음" : "영향 없음"}
    </span>
  );
}

export default function RedtideTab({ data, stations, selectedStation }: Props) {
  if (data.length === 0) {
    return (
      <p style={{ color: "var(--text-secondary)" }}>
        최근 30일간 대상 지역에 적조 속보가 없습니다.
      </p>
    );
  }

  const myStation = stations.find((s) => s.sta_cde === selectedStation);
  const aliasMap = buildAliasMap(stations);
  const myAliases = myStation ? aliasMap[cityOf(myStation.region)] ?? [] : [];

  const withImpact = data.map((row) => ({
    row,
    affected: myAliases.some((alias) => row.txt_seas.includes(alias)),
  }));
  withImpact.sort((a, b) => Number(b.affected) - Number(a.affected));

  return (
    <div className="flex flex-col gap-2.5">
      {myStation && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          "{myStation.region}" 기준으로 판단했어요 (정확한 위치가 아닌 지명으로 근사한 값이에요).
        </p>
      )}
      {withImpact.map(({ row, affected }, i) => (
        <div
          key={`${row.cod_news}-${i}`}
          className="rounded-2xl p-4"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {row.day_report}
            </span>
            <ImpactBadge affected={affected} />
          </div>
          <p className="mt-1 text-base" style={{ color: "var(--text-secondary)" }}>
            원인생물: <span className="italic">{row.nam_biology}</span>
          </p>
          <p className="mt-1 text-base" style={{ color: "var(--text-secondary)" }}>
            발생 해역: {row.txt_seas}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            수온 {row.min_watertemp}~{row.max_watertemp}°C · 밀도 {row.min_density}~{row.max_density}
          </p>
        </div>
      ))}
    </div>
  );
}
