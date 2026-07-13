import type { RedtideBulletin, RiskResult } from "../api";

interface Props {
  data: RedtideBulletin[];
  stations: RiskResult[];
  selectedStation: string;
}

// 국립수산과학원 적조속보 원문은 학명(라틴어)만 표기한다. 국내 언론·기관 자료에서
// 통용되는 한글 표기로 옮긴다 — 생물학적 국명이 별도로 표준화되어 있진 않아 학명을
// 소리나는 대로 옮긴 것이다. 매핑에 없는 학명은 원문 그대로 보여준다.
const SPECIES_KOREAN_NAME: Record<string, string> = {
  "Akashiwo sanguinea": "아카시와 상귀니아",
  "Karenia mikimotoi": "카레니아 미키모토이",
  "Cochlodinium polykrikoides": "코클로디니움 폴리크리코이데스",
  "Scrippsiella sp.": "스크립셀라",
  "Scrippsiella trochoidea": "스크립셀라",
};

function speciesLabel(latinName: string): string {
  return SPECIES_KOREAN_NAME[latinName] ?? latinName;
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
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: affected
          ? "color-mix(in srgb, var(--critical) 14%, transparent)"
          : "color-mix(in srgb, var(--text-muted) 14%, transparent)",
        color: affected ? "var(--critical)" : "var(--text-muted)",
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
    <div>
      {myStation && (
        <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
          "{myStation.region}" 기준 판단 — 위경도 반경이 아닌 조사해역 지명 일치 여부로
          근사합니다.
        </p>
      )}
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
              <th className="p-3">내 어장 영향</th>
              <th className="p-3">속보일자</th>
              <th className="p-3">원인생물</th>
              <th className="p-3">조사해역</th>
              <th className="p-3 text-right">수온(min~max)</th>
              <th className="p-3 text-right">밀도(min~max)</th>
            </tr>
          </thead>
          <tbody>
            {withImpact.map(({ row, affected }, i) => (
              <tr
                key={`${row.cod_news}-${i}`}
                className="border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="p-3">
                  <ImpactBadge affected={affected} />
                </td>
                <td className="p-3 font-medium">{row.day_report}</td>
                <td className="p-3" style={{ color: "var(--text-secondary)" }} title={row.nam_biology}>
                  {speciesLabel(row.nam_biology)}
                </td>
                <td className="p-3">{row.txt_seas}</td>
                <td className="p-3 text-right tabular-nums">
                  {row.min_watertemp}~{row.max_watertemp}℃
                </td>
                <td className="p-3 text-right tabular-nums">
                  {row.min_density}~{row.max_density}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
