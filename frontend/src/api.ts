const API_BASE = "http://localhost:8010";

export interface TemperatureReading {
  sta_cde: string;
  sta_nam_kor: string;
  obs_dat: string;
  obs_tim: string;
  obs_lay: string;
  obs_lay_label: string;
  wtr_tmp: number;
  region: string;
}

export interface RiskResult {
  sta_cde: string;
  species: string;
  level: "정상" | "관심" | "주의" | "경보" | "데이터 부족";
  current_temp: number | null;
  predicted_temp_72h: number | null;
  consecutive_days_alert: number;
  reason: string;
  region: string;
  observed_at: string | null;
  day_over_day_delta: number | null;
  rising_streak_days: number;
}

export interface RedtideBulletin {
  cod_news: string;
  day_report: string;
  nam_biology: string;
  txt_seas: string;
  min_density: string;
  max_density: string;
  min_watertemp: string;
  max_watertemp: string;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 다시 시도해주세요.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API 오류 (${res.status}): ${path}`);
  return res.json();
}

export const fetchSpecies = () => getJSON<string[]>("/api/species");

export const fetchTemperature = () => getJSON<TemperatureReading[]>("/api/temperature");

export const fetchRisk = (species: string) =>
  getJSON<RiskResult[]>(`/api/risk?species=${encodeURIComponent(species)}`);

export const fetchRedtide = () => getJSON<RedtideBulletin[]>("/api/redtide");

export interface NearestStationMatch {
  sta_cde: string;
  region: string;
  distance_km: number;
  far_match: boolean;
}

export interface Farm extends NearestStationMatch {
  id: number;
  name: string;
  lat: number;
  lon: number;
  species: string;
  stocking_info: string;
  created_at: string;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API 오류 (${res.status}): ${path}`);
  return res.json();
}

export const fetchNearestStation = (lat: number, lon: number) =>
  postJSON<NearestStationMatch>("/api/farms/nearest-station", { lat, lon });

export const createFarm = (params: {
  name: string;
  lat: number;
  lon: number;
  species: string;
  stocking_info: string;
}) => postJSON<Farm>("/api/farms", params);

export const fetchFarm = (id: number) => getJSON<Farm>(`/api/farms/${id}`);

export const fetchVapidPublicKey = () => getJSON<{ key: string }>("/api/push/vapid-public-key");

export async function subscribePush(params: {
  sta_cde: string;
  species: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`알림 구독 실패 (${res.status})`);
}

export type CoachUrgency = "now" | "today" | "monitor";

export interface CoachAction {
  title: string;
  detail: string;
  urgency: CoachUrgency;
}

export interface CoachAdvice {
  situation_summary: string;
  actions: CoachAction[];
  contact_note: string | null;
}

// 코치가 절대 하면 안 되는 말(향후 수온 전망/하강 시점 등 예측성 문구)이 새어
// 나왔을 때 화면에 노출되지 않도록 코드로도 한 번 더 거른다 — 시스템 프롬프트만
// 믿지 않는 이중 방어.
const FORBIDDEN_PREDICTIVE_PATTERNS = [
  /\d+\s*시간\s*(이내|안에|후)/,
  /\d+\s*일\s*(이내|안에|뒤|후)/,
  /하강\s*(예상|전망|할\s*것)/,
  /상승\s*(예상|전망|할\s*것)/,
  /(으로|로)\s*예상됩니다/,
  /예측/,
  /전망/,
];

function hasForbiddenPrediction(text: string): boolean {
  return FORBIDDEN_PREDICTIVE_PATTERNS.some((p) => p.test(text));
}

// contact_note에 실존 여부를 확인할 수 없는 전화번호를 지어내는 경우가 실제로
// 관측됐다(예: 존재 여부 미확인 국번) — 기관명 안내는 유용하지만 지어낸 번호는
// 위험하므로, 전화번호처럼 보이는 패턴이 있으면 그 문장 자체를 통째로 버린다.
const PHONE_NUMBER_PATTERN = /\d{2,4}[-.]\d{3,4}[-.]\d{4}/;

function hasFabricatedContact(text: string): boolean {
  return PHONE_NUMBER_PATTERN.test(text);
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

const VALID_URGENCIES: CoachUrgency[] = ["now", "today", "monitor"];

/** 원문 문자열을 파싱해 CoachAdvice로 만든다. 형식이 어긋나면 예외를 던진다 —
 * 파싱 실패한 원문 자체는 호출부가 화면에 노출하지 않는다. */
function parseCoachAdvice(raw: string): CoachAdvice {
  const cleaned = stripJsonFence(raw);
  const parsed = JSON.parse(cleaned);

  if (!parsed || typeof parsed.situation_summary !== "string" || !Array.isArray(parsed.actions)) {
    throw new Error("응답 형식이 올바르지 않습니다.");
  }

  const rawActions: unknown[] = Array.isArray(parsed.actions) ? parsed.actions : [];
  const actions: CoachAction[] = rawActions
    .filter(
      (a: unknown): a is { title: string; detail: string; urgency?: string } =>
        !!a &&
        typeof (a as Record<string, unknown>).title === "string" &&
        typeof (a as Record<string, unknown>).detail === "string"
    )
    .filter((a) => !hasForbiddenPrediction(a.title) && !hasForbiddenPrediction(a.detail))
    .slice(0, 4)
    .map((a) => ({
      title: a.title,
      detail: a.detail,
      urgency: VALID_URGENCIES.includes(a.urgency as CoachUrgency) ? (a.urgency as CoachUrgency) : "monitor",
    }));

  const contactNote =
    typeof parsed.contact_note === "string" &&
    !hasForbiddenPrediction(parsed.contact_note) &&
    !hasFabricatedContact(parsed.contact_note)
      ? parsed.contact_note
      : null;

  return { situation_summary: parsed.situation_summary, actions, contact_note: contactNote };
}

async function requestCoachRaw(sta_cde: string, species: string): Promise<string> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/coach`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sta_cde, species }),
    },
    45000 // Claude 호출 포함 — 여유 있게
  );
  if (!res.ok) throw new Error(`대응 코치 호출 실패 (${res.status})`);
  const data = await res.json();
  return data.message as string;
}

export async function fetchCoachAdvice(sta_cde: string, species: string): Promise<CoachAdvice> {
  const first = await requestCoachRaw(sta_cde, species);
  try {
    return parseCoachAdvice(first);
  } catch {
    // 같은 문자열을 다시 파싱해봤자 의미가 없으므로, 파싱 실패 시에는 API를
    // 한 번 더 호출해서 새 응답으로 재시도한다.
    const second = await requestCoachRaw(sta_cde, species);
    try {
      return parseCoachAdvice(second);
    } catch {
      throw new Error("안내를 불러오지 못했어요. 다시 시도해 주세요.");
    }
  }
}

export interface PhotoAnalysisResult {
  quantity_estimate: string;
  cause_estimate: string;
  full_observation: string;
}

export interface AnalyzeReportResult {
  request_id: string;
  photo_filename: string;
  region: string;
  risk: RiskResult;
  analysis: PhotoAnalysisResult;
  inconsistent: boolean;
}

export async function analyzeDamagePhoto(params: {
  sta_cde: string;
  species: string;
  photo: File;
}): Promise<AnalyzeReportResult> {
  const form = new FormData();
  form.append("sta_cde", params.sta_cde);
  form.append("species", params.species);
  form.append("photo", params.photo);

  const res = await fetchWithTimeout(
    `${API_BASE}/api/damage-report/analyze`,
    { method: "POST", body: form },
    45000 // Claude 비전 호출 — 여유 있게
  );
  if (!res.ok) throw new Error(`사진 분석 실패 (${res.status})`);
  return res.json();
}

export interface ReportGenerateParams {
  request_id: string;
  photo_filename: string;
  sta_cde: string;
  species: string;
  owner: string;
  contact: string;
  address: string;
  farm_name: string;
  farm_area_ha: string;
  license_no: string;
  risk: RiskResult;
  analysis: PhotoAnalysisResult;
}

async function fetchReportPdf(path: string, params: ReportGenerateParams): Promise<Blob> {
  const res = await fetchWithTimeout(
    `${API_BASE}${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    20000 // 로컬 PDF 렌더링만 — API 재호출 없음
  );
  if (!res.ok) throw new Error(`PDF 생성 실패 (${res.status})`);
  return res.blob();
}

export const fetchSummaryPdf = (params: ReportGenerateParams) =>
  fetchReportPdf("/api/damage-report/summary-pdf", params);

export const fetchOfficialPdf = (params: ReportGenerateParams) =>
  fetchReportPdf("/api/damage-report/official-pdf", params);
