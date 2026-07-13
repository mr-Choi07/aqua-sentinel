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

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API 오류 (${res.status}): ${path}`);
  return res.json();
}

export const fetchSpecies = () => getJSON<string[]>("/api/species");

export const fetchTemperature = () => getJSON<TemperatureReading[]>("/api/temperature");

export const fetchRisk = (species: string) =>
  getJSON<RiskResult[]>(`/api/risk?species=${encodeURIComponent(species)}`);

export const fetchRedtide = () => getJSON<RedtideBulletin[]>("/api/redtide");

export async function fetchCoachMessage(sta_cde: string, species: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sta_cde, species }),
  });
  if (!res.ok) throw new Error(`대응 코치 호출 실패 (${res.status})`);
  const data = await res.json();
  return data.message as string;
}

export async function submitDamageReport(params: {
  sta_cde: string;
  species: string;
  owner: string;
  farm_name: string;
  photo: File;
}): Promise<Blob> {
  const form = new FormData();
  form.append("sta_cde", params.sta_cde);
  form.append("species", params.species);
  form.append("owner", params.owner);
  form.append("farm_name", params.farm_name);
  form.append("photo", params.photo);

  const res = await fetch(`${API_BASE}/api/damage-report`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`보고서 생성 실패 (${res.status})`);
  return res.blob();
}
