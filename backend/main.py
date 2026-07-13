"""어장지킴이 FastAPI 백엔드 — pipeline/ 모듈을 REST API로 노출한다.

프론트엔드(React, frontend/)가 이 서버를 호출한다. Streamlit 대시보드(app/main.py)는
이 백엔드로 대체되어 제거되었다.
"""

import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.coach import generate_coaching_message
from pipeline.collect_kosha import TARGET_STATIONS, fetch_realtime_temperature
from pipeline.collect_redtide import fetch_redtide_info, filter_target_region
from pipeline.damage_report import analyze_damage_photo, build_damage_report
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


@app.get("/api/species")
def get_species() -> list[str]:
    return list(SPECIES_THRESHOLDS.keys())


@app.get("/api/temperature")
def get_temperature() -> list[dict]:
    records = fetch_realtime_temperature()
    insert_readings(records, TARGET_STATIONS)  # 조회만으로도 이력이 누적되도록 함께 적재
    for r in records:
        r["region"] = TARGET_STATIONS.get(r["sta_cde"])
        r["wtr_tmp"] = float(r["wtr_tmp"])
        r["obs_lay_label"] = LAYER_LABELS.get(str(r["obs_lay"]), r["obs_lay"])
    return records


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


@app.post("/api/damage-report")
def post_damage_report(
    sta_cde: str = Form(...),
    species: str = Form("일반(기본)"),
    owner: str = Form(""),
    farm_name: str = Form(""),
    photo: UploadFile = File(...),
) -> FileResponse:
    if sta_cde not in TARGET_STATIONS:
        raise HTTPException(400, f"알 수 없는 관측소 코드입니다: {sta_cde}")
    region = TARGET_STATIONS[sta_cde]
    risk_result = classify_all_stations([sta_cde], species=species)[0]

    upload_dir = Path(tempfile.gettempdir()) / "aqua_sentinel_uploads"
    upload_dir.mkdir(exist_ok=True)
    photo_path = upload_dir / photo.filename
    with open(photo_path, "wb") as f:
        f.write(photo.file.read())

    ai_analysis = analyze_damage_photo(str(photo_path), species=species, region=region)

    output_path = upload_dir / f"damage_report_{photo.filename}.pdf"
    build_damage_report(
        output_path=str(output_path),
        farm_info={"owner": owner, "farm_name": farm_name, "region": region, "species": species},
        risk_context=risk_result,
        ai_analysis=ai_analysis,
        photo_path=str(photo_path),
    )
    return FileResponse(output_path, media_type="application/pdf", filename="damage_report.pdf")
