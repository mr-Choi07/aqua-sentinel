import { AlertTriangle, CheckCircle2, CircleAlert, HelpCircle, type LucideIcon } from "lucide-react";

export type RiskLevel = "정상" | "관심" | "주의" | "경보" | "데이터 부족";

export interface StatusInfo {
  color: string;
  bg: string;
  Icon: LucideIcon;
  label: string;
}

// "관심"과 "주의"는 같은 노랑 계열이 아니라 반드시 구분한다.
// - 관심: 추세상 72시간(3일) 내 임계수온 도달이 "예상"되는 상황 (아직 안 옴)
// - 주의: 이미 관측 수온이 임계치 이상(국립수산과학원 주의보 발령 기준과 동일)
// 이 둘을 같은 색으로 묶으면 "곧 그럴 수도 있음"과 "지금 이미 그럼"을
// 사용자가 구분하지 못해 긴급도 판단을 그르칠 수 있다.
const STATUS_MAP: Record<RiskLevel, StatusInfo> = {
  정상: { color: "var(--good)", bg: "color-mix(in srgb, var(--good) 16%, transparent)", Icon: CheckCircle2, label: "정상입니다" },
  관심: { color: "var(--caution)", bg: "color-mix(in srgb, var(--caution) 18%, transparent)", Icon: CircleAlert, label: "수온이 오르고 있어요" },
  주의: { color: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 18%, transparent)", Icon: AlertTriangle, label: "지금 수온이 높아요" },
  경보: { color: "var(--critical)", bg: "color-mix(in srgb, var(--critical) 18%, transparent)", Icon: AlertTriangle, label: "위험합니다" },
  "데이터 부족": { color: "var(--neutral)", bg: "color-mix(in srgb, var(--neutral) 16%, transparent)", Icon: HelpCircle, label: "확인 중이에요" },
};

export function statusOf(level: string): StatusInfo {
  return STATUS_MAP[level as RiskLevel] ?? STATUS_MAP["데이터 부족"];
}

/** 홈 화면 큰 문구 아래 한 줄 설명 — 등급별로 긴급도가 다르게 읽히도록 문장을 다르게 쓴다. */
export function statusSentence(level: string, currentTemp: number | null): string {
  const temp = currentTemp !== null ? `현재 수온 ${currentTemp.toFixed(1)}°C` : "현재 수온 정보 없음";
  switch (level as RiskLevel) {
    case "정상":
      return `${temp}, 평소와 비슷해요`;
    case "관심":
      return `${temp}, 며칠 안에 더 높아질 수 있어요`;
    case "주의":
      return `${temp}로 이미 높아요, 오늘 확인하고 대응하세요`;
    case "경보":
      return `${temp}로 위험한 상태가 계속되고 있어요, 지금 바로 조치하세요`;
    default:
      return "관측소 데이터를 아직 확인하지 못했어요";
  }
}

/** 판단 근거가 "언제" 기준인지 — 블랙박스 불신을 줄이기 위한 최소한의 투명성. */
export function formatObservedAt(observedAt: string | null): string {
  if (!observedAt) return "관측 정보 없음";
  const obsDate = new Date(observedAt.replace(" ", "T"));
  if (Number.isNaN(obsDate.getTime())) return "관측 정보 없음";

  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const hour = obsDate.getHours();
  const ampm = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const timeStr = `${ampm} ${hour12}시`;

  if (isSameDay(obsDate, now)) return `오늘 ${timeStr} 관측 기준`;
  if (isSameDay(obsDate, yesterday)) return `어제 ${timeStr} 관측 기준`;
  return `${obsDate.getMonth() + 1}월 ${obsDate.getDate()}일 ${timeStr} 관측 기준`;
}

/** 카드의 빈 공간에 넣을 추세 한 줄 — "오르고 있나"가 "지금 괜찮나"만큼 중요하다. */
export function trendSentence(
  dayOverDayDelta: number | null,
  risingStreakDays: number
): string | null {
  if (risingStreakDays >= 2) return `${risingStreakDays}일째 오르는 중 ↗`;
  if (dayOverDayDelta !== null) {
    const sign = dayOverDayDelta >= 0 ? "+" : "";
    return `어제보다 ${sign}${dayOverDayDelta.toFixed(1)}°C`;
  }
  return null;
}

/** "무엇을 해야 하나요?" 버튼 아래 보조 문구 — 버튼 순서는 고정하되 강조만 상태에 연동한다. */
export function coachButtonHint(level: string): { text: string; color: string } | null {
  switch (level as RiskLevel) {
    case "정상":
      return { text: "지금은 특별한 조치가 필요하지 않아요", color: "var(--text-muted)" };
    case "주의":
      return { text: "오늘 확인하고 대응하세요", color: "var(--warning)" };
    case "경보":
      return { text: "지금 바로 확인하세요", color: "var(--critical)" };
    default:
      return null;
  }
}
