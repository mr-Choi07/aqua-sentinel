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

export async function fetchCoachMessage(sta_cde: string, species: string): Promise<string> {
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
