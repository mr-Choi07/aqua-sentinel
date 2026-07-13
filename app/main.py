"""어장지킴이 — 고수온·적조 조기경보 대시보드 (기본 화면)."""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.coach import generate_coaching_message
from pipeline.collect_kosha import TARGET_STATIONS, fetch_realtime_temperature
from pipeline.collect_redtide import fetch_redtide_info, filter_target_region
from pipeline.damage_report import analyze_damage_photo, build_damage_report
from pipeline.db import insert_readings
from pipeline.risk import SPECIES_THRESHOLDS, classify_all_stations

LAYER_LABELS = {"1": "표층", "2": "중층", "3": "저층"}
# 상태 팔레트: 정상=good, 관심=warning, 주의=serious, 경보=critical (색상만으로 판단하지
# 않도록 아이콘 + 텍스트 라벨을 항상 함께 표기한다)
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

with st.sidebar:
    st.title("🐟 어장지킴이")
    st.caption("고수온·적조 조기경보 + 피해 증빙 자동화 AI")
    st.divider()
    selected_species = st.selectbox("양식 어종", list(SPECIES_THRESHOLDS.keys()))
    if selected_species in ("굴", "참돔"):
        st.caption("⚠️ 이 어종은 폐사 임계수온 근거가 부족해 일반 기준을 적용 중입니다.")
    with st.expander("위험도는 어떻게 계산되나요?"):
        st.write(
            "국립수산과학원의 공식 고수온 특보(정밀 해양예보모델 기반)를 대체하지 않는 "
            "보조 지표입니다. 실시간 관측 수온의 단기 추세로 정상/관심/주의/경보 4단계를 "
            "근사해서 계산합니다."
        )

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
    col3.metric("주의·경보 단계 어장", int(alert_count))

st.divider()

tab_risk, tab_temp, tab_redtide, tab_coach, tab_report = st.tabs(
    ["위험도 현황", "수온 상세", "적조 속보", "AI 대응 코치", "피해 신고서"]
)

with tab_risk:
    if risk_df.empty:
        st.info("위험도 데이터가 없습니다.")
    else:
        st.dataframe(
            risk_df.sort_values("level")[
                ["region", "badge", "current_temp", "predicted_temp_72h", "reason"]
            ].rename(
                columns={
                    "region": "관측소",
                    "badge": "위험도",
                    "current_temp": "현재 수온(℃)",
                    "predicted_temp_72h": "72시간 후 예상(℃)",
                    "reason": "판단 근거",
                }
            ),
            use_container_width=True,
            hide_index=True,
        )

with tab_temp:
    if temp_df.empty:
        st.info("수온 데이터가 없습니다.")
    else:
        st.bar_chart(surface_df.set_index("sta_nam_kor")["wtr_tmp"], y_label="수온(℃)")
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

with tab_redtide:
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

with tab_coach:
    st.caption("호출 시에만 Claude API를 사용합니다 (자동 호출 없음).")
    if risk_df.empty:
        st.info("위험도 데이터가 없어 코치를 호출할 수 없습니다.")
    else:
        station_options = dict(zip(risk_df["region"], risk_df["sta_cde"]))
        selected_region = st.selectbox("관측소 선택", list(station_options.keys()))
        if st.button("대응 코치에게 물어보기", type="primary"):
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

with tab_report:
    st.caption(
        "실제 신고 서식이 아니며, 신고 준비를 돕는 참고 자료입니다. "
        "호출 시에만 Claude API를 사용합니다."
    )
    if risk_df.empty:
        st.info("위험도 데이터가 없어 보고서를 생성할 수 없습니다.")
    else:
        report_station_options = dict(zip(risk_df["region"], risk_df["sta_cde"]))
        with st.form("damage_report_form"):
            report_region = st.selectbox("관측소", list(report_station_options.keys()))
            owner_name = st.text_input("어업인명")
            farm_name = st.text_input("어장명")
            uploaded_photo = st.file_uploader(
                "폐사 사진 업로드", type=["jpg", "jpeg", "png", "webp"]
            )
            submitted = st.form_submit_button("보고서 생성", type="primary")

        if submitted:
            if uploaded_photo is None:
                st.warning("사진을 업로드해주세요.")
            else:
                scratch_dir = Path(__file__).resolve().parent.parent / "data" / "_uploads"
                scratch_dir.mkdir(parents=True, exist_ok=True)
                photo_path = scratch_dir / uploaded_photo.name
                with open(photo_path, "wb") as f:
                    f.write(uploaded_photo.getbuffer())

                selected_row = risk_df[
                    risk_df["sta_cde"] == report_station_options[report_region]
                ].iloc[0]
                with st.spinner("사진 분석 및 보고서 생성 중..."):
                    try:
                        ai_analysis = analyze_damage_photo(
                            str(photo_path), species=selected_species, region=report_region
                        )
                        output_path = scratch_dir.parent / f"damage_report_{uploaded_photo.name}.pdf"
                        build_damage_report(
                            output_path=str(output_path),
                            farm_info={
                                "owner": owner_name,
                                "farm_name": farm_name,
                                "region": report_region,
                                "species": selected_species,
                            },
                            risk_context=selected_row.to_dict(),
                            ai_analysis=ai_analysis,
                            photo_path=str(photo_path),
                        )
                        st.success("보고서가 생성되었습니다.")
                        with open(output_path, "rb") as f:
                            st.download_button(
                                "PDF 다운로드",
                                f,
                                file_name="damage_report.pdf",
                                mime="application/pdf",
                            )
                    except Exception as e:
                        st.error(f"보고서 생성 실패: {e}")
