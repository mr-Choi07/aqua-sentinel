"""어장지킴이 — 고수온·적조 조기경보 대시보드 (기본 화면)."""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.collect_kosha import TARGET_STATIONS, fetch_realtime_temperature
from pipeline.collect_redtide import fetch_redtide_info, filter_target_region

# 고수온 위험 등급 임계값(℃). 실제 국립수산과학원 특보 기준은 예보 기반(28℃ 도달/지속
# 예상일수)이라 이것과 다르다 — 여기서는 현재 관측 수온만으로 단순화한 잠정 기준이다.
# TODO: 위험도 산출 로직 단계에서 특보 기준에 맞게 정교화할 것
TEMP_WARNING = 25.0
TEMP_DANGER = 28.0

LAYER_LABELS = {"1": "표층", "2": "중층", "3": "저층"}


def classify_temp(temp: float) -> str:
    if temp >= TEMP_DANGER:
        return "🔴 경보"
    if temp >= TEMP_WARNING:
        return "🟡 주의"
    return "🟢 정상"


@st.cache_data(ttl=1800)
def load_temperature_data() -> pd.DataFrame:
    records = fetch_realtime_temperature()
    df = pd.DataFrame(records)
    df["region"] = df["sta_cde"].map(TARGET_STATIONS)
    df["wtr_tmp"] = df["wtr_tmp"].astype(float)
    df["obs_lay"] = df["obs_lay"].astype(str).map(LAYER_LABELS)
    df["위험도"] = df["wtr_tmp"].map(classify_temp)
    return df


@st.cache_data(ttl=1800)
def load_redtide_data() -> pd.DataFrame:
    records = fetch_redtide_info()
    target_records = filter_target_region(records)
    return pd.DataFrame(target_records)


st.set_page_config(page_title="어장지킴이", page_icon="🐟", layout="wide")
st.title("🐟 어장지킴이")
st.caption("고수온·적조 조기경보 + 피해 증빙 자동화 AI — 통영·거제·남해·고성")

try:
    temp_df = load_temperature_data()
except Exception as e:
    st.error(f"수온 데이터를 불러오지 못했습니다: {e}")
    temp_df = pd.DataFrame()

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
    col3.metric("경보 단계 관측소", (surface_df["위험도"] == "🔴 경보").sum())

st.subheader("실시간 수온 현황")
if temp_df.empty:
    st.info("수온 데이터가 없습니다.")
else:
    st.dataframe(
        temp_df[["region", "sta_nam_kor", "obs_lay", "wtr_tmp", "obs_tim", "위험도"]]
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
