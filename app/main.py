"""어장지킴이 — 고수온·적조 조기경보 대시보드 (기본 화면)."""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.coach import generate_coaching_message
from pipeline.collect_kosha import TARGET_STATIONS, fetch_realtime_temperature
from pipeline.collect_redtide import fetch_redtide_info, filter_target_region
from pipeline.db import insert_readings
from pipeline.risk import SPECIES_THRESHOLDS, classify_all_stations

LAYER_LABELS = {"1": "표층", "2": "중층", "3": "저층"}
LEVEL_BADGES = {
    "경보": "🔴 경보",
    "주의": "🟠 주의",
    "관심": "🟡 관심",
    "정상": "🟢 정상",
    "데이터 부족": "⚪ 데이터 부족",
}


@st.cache_data(ttl=1800)
def load_temperature_data() -> pd.DataFrame:
    records = fetch_realtime_temperature()
    insert_readings(records, TARGET_STATIONS)  # 대시보드 조회만으로도 이력이 누적되도록 함께 적재

    df = pd.DataFrame(records)
    df["region"] = df["sta_cde"].map(TARGET_STATIONS)
    df["wtr_tmp"] = df["wtr_tmp"].astype(float)
    df["obs_lay"] = df["obs_lay"].astype(str).map(LAYER_LABELS)
    return df


@st.cache_data(ttl=1800)
def load_risk_data(species: str) -> pd.DataFrame:
    results = classify_all_stations(list(TARGET_STATIONS.keys()), species=species)
    df = pd.DataFrame(results)
    df["region"] = df["sta_cde"].map(TARGET_STATIONS)
    df["badge"] = df["level"].map(LEVEL_BADGES)
    return df


@st.cache_data(ttl=1800)
def load_redtide_data() -> pd.DataFrame:
    records = fetch_redtide_info()
    target_records = filter_target_region(records)
    return pd.DataFrame(target_records)


st.set_page_config(page_title="어장지킴이", page_icon="🐟", layout="wide")
st.title("🐟 어장지킴이")
st.caption("고수온·적조 조기경보 + 피해 증빙 자동화 AI — 통영·거제·남해·고성")
st.info(
    "위험도는 국립수산과학원의 공식 고수온 특보(정밀 해양예보모델 기반)를 대체하지 않으며, "
    "실시간 관측 데이터의 단기 추세를 기반으로 한 보조 지표입니다.",
    icon="ℹ️",
)

selected_species = st.selectbox("양식 어종 선택 (어종별 임계온도 반영)", list(SPECIES_THRESHOLDS.keys()))
if selected_species in ("굴", "참돔"):
    st.caption("⚠️ 이 어종은 신뢰할 만한 폐사 임계수온 자료를 찾지 못해 일반 기준을 그대로 적용 중입니다.")

try:
    temp_df = load_temperature_data()
except Exception as e:
    st.error(f"수온 데이터를 불러오지 못했습니다: {e}")
    temp_df = pd.DataFrame()

try:
    risk_df = load_risk_data(selected_species)
except Exception as e:
    st.error(f"위험도를 계산하지 못했습니다: {e}")
    risk_df = pd.DataFrame()

try:
    redtide_df = load_redtide_data()
except Exception as e:
    st.error(f"적조 데이터를 불러오지 못했습니다: {e}")
    redtide_df = pd.DataFrame()

col1, col2, col3 = st.columns(3)
col1.metric("모니터링 관측소", len(TARGET_STATIONS))
if not temp_df.empty:
    surface_df = temp_df[temp_df["obs_lay"] == "표층"]
    col2.metric("표층 평균 수온", f"{surface_df['wtr_tmp'].mean():.1f} ℃")
if not risk_df.empty:
    alert_count = risk_df["level"].isin(["주의", "경보"]).sum()
    col3.metric("주의·경보 단계 어장", alert_count)

st.subheader("어장별 위험도")
if risk_df.empty:
    st.info("위험도 데이터가 없습니다.")
else:
    st.dataframe(
        risk_df.sort_values("level")[
            ["region", "sta_cde", "badge", "current_temp", "predicted_temp_72h", "reason"]
        ].rename(
            columns={
                "region": "관측소",
                "sta_cde": "코드",
                "badge": "위험도",
                "current_temp": "현재 수온(℃)",
                "predicted_temp_72h": "72시간 후 예상(℃)",
                "reason": "판단 근거",
            }
        ),
        use_container_width=True,
        hide_index=True,
    )

st.subheader("AI 대응 코치")
st.caption("호출 시에만 Claude API를 사용합니다 (자동 호출 없음).")
if risk_df.empty:
    st.info("위험도 데이터가 없어 코치를 호출할 수 없습니다.")
else:
    station_options = dict(zip(risk_df["region"], risk_df["sta_cde"]))
    selected_region = st.selectbox("코치를 요청할 관측소 선택", list(station_options.keys()))
    if st.button("대응 코치에게 물어보기"):
        selected_row = risk_df[risk_df["sta_cde"] == station_options[selected_region]].iloc[0]
        with st.spinner("Claude Haiku 4.5 호출 중..."):
            try:
                message = generate_coaching_message(
                    risk_result=selected_row.to_dict(),
                    species=selected_species,
                    region=selected_region,
                )
                st.markdown(message)
            except Exception as e:
                st.error(f"대응 코치 호출 실패: {e}")

st.subheader("실시간 수온 현황 (전체 관측층)")
if temp_df.empty:
    st.info("수온 데이터가 없습니다.")
else:
    st.dataframe(
        temp_df[["region", "sta_nam_kor", "obs_lay", "wtr_tmp", "obs_tim"]]
        .sort_values(["region", "obs_lay"])
        .rename(
            columns={
                "region": "지역",
                "sta_nam_kor": "관측소",
                "obs_lay": "수심층",
                "wtr_tmp": "수온(℃)",
                "obs_tim": "관측시각",
            }
        ),
        use_container_width=True,
        hide_index=True,
    )

    st.bar_chart(
        surface_df.set_index("sta_nam_kor")["wtr_tmp"],
        y_label="수온(℃)",
    )

st.subheader("적조 속보 (최근 30일, 대상 지역)")
if redtide_df.empty:
    st.info("최근 30일간 대상 지역에 적조 속보가 없습니다.")
else:
    st.dataframe(
        redtide_df.rename(
            columns={
                "day_report": "속보일자",
                "nam_biology": "원인생물",
                "txt_seas": "조사해역",
                "min_watertemp": "수온(min)",
                "max_watertemp": "수온(max)",
                "min_density": "밀도(min)",
                "max_density": "밀도(max)",
            }
        )[["속보일자", "원인생물", "조사해역", "수온(min)", "수온(max)", "밀도(min)", "밀도(max)"]],
        use_container_width=True,
        hide_index=True,
    )
