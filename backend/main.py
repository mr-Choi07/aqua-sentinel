"""어장지킴이 FastAPI 백엔드 — pipeline/ 모듈을 REST API로 노출한다.

프론트엔드(React, frontend/)가 이 서버를 호출한다. Streamlit 대시보드(app/main.py)는
이 백엔드로 대체되어 제거되었다.

피해 신고서 흐름은 세 단계로 나뉜다 — 사진 분석(Claude 호출, 1회) → 사용자가
결과를 검토 → 참고용 요약본/공식 서식 오버레이 중 원하는 것을 선택해 PDF 생성
(로컬 렌더링만, 재호출 없음). 이렇게 나눈 이유는 (1) 사용자가 분석 결과와 불일치
경고를 먼저 확인하고 (2) 같은 사진을 두 번 분석하느라 API 비용이 두 배로 드는
일을 막기 위해서다.
"""

import sys
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.coach import generate_coaching_message
from pipeline.collect_kosha import TARGET_STATIONS, fetch_realtime_temperature
from pipeline.collect_redtide import fetch_redtide_info, filter_target_region
from pipeline.damage_report import PhotoAnalysis, analyze_damage_photo, build_damage_report, detect_inconsistency
from pipeline.damage_report_official import build_official_overlay
from pipeline.db import insert_readings
from pipeline.risk import SPECIES_THRESHOLDS, classify_all_stations

app = FastAPI(title="어장지킴이 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite 개발 서버
    allow_methods=["*"],
    allow_headers=["*"],
)

LAYER_LABELS = {"1": "표층", "2": "중층", "3": "저층"}
UPLOAD_DIR = Path(tempfile.gettempdir()) / "aqua_sentinel_uploads"


@app.get("/api/species")
def get_species() -> list[str]:
    return list(SPECIES_THRESHOLDS.keys())


@app.get("/api/temperature")
def get_temperature() -> list[dict]:
    records = fetch_realtime_temperature()
    insert_readings(records, TARGET_STATIONS)  # 조회만으로도 이력이 누적되도록 함께 적재

    result = []
    for r in records:
        # 센서 결측 시 NIFS API가 wtr_tmp를 빈 문자열로 주는 경우가 있다 —
        # 그 레코드만 빼고, 요청 전체가 500으로 죽는 걸 막는다.
        try:
            r["wtr_tmp"] = float(r["wtr_tmp"])
        except (TypeError, ValueError):
            continue
        r["region"] = TARGET_STATIONS.get(r["sta_cde"])
        r["obs_lay_label"] = LAYER_LABELS.get(str(r["obs_lay"]), r["obs_lay"])
        result.append(r)
    return result


@app.get("/api/risk")
def get_risk(species: str = "일반(기본)") -> list[dict]:
    if species not in SPECIES_THRESHOLDS:
        raise HTTPException(400, f"알 수 없는 어종입니다: {species}")
    results = classify_all_stations(list(TARGET_STATIONS.keys()), species=species)
    for r in results:
        r["region"] = TARGET_STATIONS.get(r["sta_cde"])
    return results


@app.get("/api/redtide")
def get_redtide() -> list[dict]:
    records = fetch_redtide_info()
    return filter_target_region(records)


class CoachRequest(BaseModel):
    sta_cde: str
    species: str = "일반(기본)"


@app.post("/api/coach")
def post_coach(req: CoachRequest) -> dict:
    if req.sta_cde not in TARGET_STATIONS:
        raise HTTPException(400, f"알 수 없는 관측소 코드입니다: {req.sta_cde}")
    region = TARGET_STATIONS[req.sta_cde]
    risk_result = classify_all_stations([req.sta_cde], species=req.species)[0]
    message = generate_coaching_message(risk_result=risk_result, species=req.species, region=region)
    return {"message": message}


@app.post("/api/damage-report/analyze")
def post_analyze_photo(
    sta_cde: str = Form(...),
    species: str = Form("일반(기본)"),
    photo: UploadFile = File(...),
) -> dict:
    """사진을 1회 분석하고, 이후 PDF 생성 단계에서 재사용할 수 있도록
    request_id로 사진을 저장해둔다."""
    if sta_cde not in TARGET_STATIONS:
        raise HTTPException(400, f"알 수 없는 관측소 코드입니다: {sta_cde}")
    region = TARGET_STATIONS[sta_cde]
    risk_result = classify_all_stations([sta_cde], species=species)[0]

    UPLOAD_DIR.mkdir(exist_ok=True)
    request_id = uuid.uuid4().hex
    photo_path = UPLOAD_DIR / f"{request_id}_{photo.filename}"
    with open(photo_path, "wb") as f:
        f.write(photo.file.read())

    analysis = analyze_damage_photo(str(photo_path), species=species, region=region)
    inconsistent = detect_inconsistency(risk_result.get("level"), analysis)

    return {
        "request_id": request_id,
        "photo_filename": photo.filename,
        "region": region,
        "risk": risk_result,
        "analysis": {
            "quantity_estimate": analysis.quantity_estimate,
            "cause_estimate": analysis.cause_estimate,
            "full_observation": analysis.full_observation,
        },
        "inconsistent": inconsistent,
    }


class ReportGenerateRequest(BaseModel):
    request_id: str
    photo_filename: str
    sta_cde: str
    species: str
    owner: str = ""
    contact: str = ""
    address: str = ""
    farm_name: str = ""
    farm_area_ha: str = ""
    license_no: str = ""
    risk: dict
    analysis: dict


def _resolve_photo_path(req: ReportGenerateRequest) -> str | None:
    path = UPLOAD_DIR / f"{req.request_id}_{req.photo_filename}"
    return str(path) if path.exists() else None


@app.post("/api/damage-report/summary-pdf")
def post_summary_pdf(req: ReportGenerateRequest) -> FileResponse:
    """참고용 요약본 — 관측 데이터/사진 소견 분리 + 불일치 경고 포함."""
    region = TARGET_STATIONS.get(req.sta_cde, "")
    analysis = PhotoAnalysis(**req.analysis)
    output_path = UPLOAD_DIR / f"{req.request_id}_summary.pdf"
    build_damage_report(
        output_path=str(output_path),
        farm_info={
            "owner": req.owner,
            "contact": req.contact,
            "region": req.address or region,
            "farm_name": req.farm_name,
            "farm_area_ha": req.farm_area_ha,
            "license_no": req.license_no,
            "species": req.species,
        },
        risk_context=req.risk,
        ai_analysis=analysis,
        photo_path=_resolve_photo_path(req),
    )
    return FileResponse(output_path, media_type="application/pdf", filename="damage_report_summary.pdf")


@app.post("/api/damage-report/official-pdf")
def post_official_pdf(req: ReportGenerateRequest) -> FileResponse:
    """공식 서식(자연재난 피해신고서) 오버레이 — 제출 준비용 도우미."""
    region = TARGET_STATIONS.get(req.sta_cde, "")
    analysis = PhotoAnalysis(**req.analysis)
    output_path = UPLOAD_DIR / f"{req.request_id}_official.pdf"
    build_official_overlay(
        output_path=str(output_path),
        farm_info={
            "owner": req.owner,
            "contact": req.contact,
            "region": req.address or region,
            "farm_name": req.farm_name,
            "farm_area_ha": req.farm_area_ha,
            "license_no": req.license_no,
        },
        ai_analysis=analysis,
    )
    return FileResponse(output_path, media_type="application/pdf", filename="damage_report_official.pdf")
