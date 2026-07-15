"""어장별 고수온 위험도 산출.

국립수산과학원의 공식 고수온 특보(주의보: 28℃ 도달 예상, 경보: 28℃ 3일 이상
지속 예상)는 정밀 해양예보모델 기반 "예측"이라 우리가 그대로 재현할 수 없다.
대신 실시간 관측 이력만으로 다음 두 가지를 근사한다.

  1) 즉시 트리거: 이미 관측 수온이 28℃ 이상이면 예측 없이 바로 위험 신호
  2) 단기 추세 예측: 최근 관측 이력에 선형회귀를 적용해 72시간 뒤 수온을 추정

주의: 이 값은 공식 특보를 대체하지 않는 보조 지표다.

어종별 임계온도(SPECIES_THRESHOLDS)는 아래 근거로 작성했다. 굴·참돔은 신뢰할 만한
개체별 폐사 임계수온 자료를 찾지 못해 일반 기준(기본값)을 그대로 쓴다 — 실제
서비스에 쓰려면 국립수산과학원에 직접 문의해서 검증할 것(TODO).

  - 우럭(조피볼락): 생존 한계 28℃ 안팎, 28℃ 초과 시 피해 발생
    (헤럴드경제, https://mbiz.heraldcorp.com/article/10560683)
  - 멍게: 20℃부터 대사·섭식 저하, 26℃ 이상 지속 시 폐사("녹아내림")
    (경남신문 창간특집, https://m.knnews.co.kr/mView.php?gubun=plan&idxno=1454848)
  - 전복: 24~25℃ 이상에서 폐사 확률 급증
    (경향신문, https://www.khan.co.kr/article/202501262007005)
  - 굴: 고수온 자체보다 동반되는 빈산소수괴가 주된 폐사 원인이라 순수 수온
    임계치 근거를 찾지 못함 — 일반 기준 사용
  - 참돔: 구체적 폐사 임계수온 자료를 찾지 못함 — 일반 기준 사용
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.db import get_recent_readings

WARNING_TEMP = 26.0  # 일반(기본) 관심 단계 진입 온도
ALERT_TEMP = 28.0  # 일반(기본) 주의 단계 즉시 트리거 온도 (공식 주의보 기준과 동일)
ALERT_DURATION_DAYS = 3  # 이 일수 이상 연속으로 alert 온도 이상이면 경보
PROJECTION_HOURS = 72  # 추세 예측 범위
HISTORY_WINDOW_HOURS = 24 * 7  # 추이 계산에 사용할 이력 조회 범위 (7일)

RISK_LEVELS = ["정상", "관심", "주의", "경보", "데이터 부족"]

# 어종별 관심/주의(경보 트리거) 임계온도(℃). 근거는 모듈 docstring 참고.
SPECIES_THRESHOLDS = {
    "일반(기본)": {"warning": WARNING_TEMP, "alert": ALERT_TEMP},
    "우럭(조피볼락)": {"warning": 26.0, "alert": 28.0},
    "멍게": {"warning": 20.0, "alert": 26.0},
    "전복": {"warning": 22.0, "alert": 24.0},
    "굴": {"warning": WARNING_TEMP, "alert": ALERT_TEMP},
    "참돔": {"warning": WARNING_TEMP, "alert": ALERT_TEMP},
}


def _parse_observed_at(observed_at: str) -> datetime:
    return datetime.strptime(observed_at, "%Y-%m-%d %H:%M:%S")


def _consecutive_days_above(readings: list[tuple[str, float]], threshold: float) -> int:
    """가장 최근 날짜부터 거슬러 올라가며, 하루 중 관측 최고온이 threshold 이상인
    날이 며칠 연속인지 센다. 관측이 없는 날은 연속이 끊긴 것으로 간주한다."""
    if not readings:
        return 0

    daily_max: dict[str, float] = {}
    for observed_at, temp in readings:
        day = observed_at.split(" ")[0]
        daily_max[day] = max(daily_max.get(day, temp), temp)

    sorted_days = sorted(daily_max.keys())
    count = 0
    for day in reversed(sorted_days):
        if daily_max[day] >= threshold:
            count += 1
        else:
            break
    return count


def _daily_max_series(readings: list[tuple[str, float]]) -> list[tuple[str, float]]:
    daily_max: dict[str, float] = {}
    for observed_at, temp in readings:
        day = observed_at.split(" ")[0]
        daily_max[day] = max(daily_max.get(day, temp), temp)
    return sorted(daily_max.items())


def _rising_streak_days(readings: list[tuple[str, float]]) -> int:
    """가장 최근 날짜부터 거슬러 올라가며, 전날보다 일 최고수온이 높은 날이
    며칠 연속인지 센다(추세 표시용 — "3일째 오르는 중" 같은 문구에 사용)."""
    series = _daily_max_series(readings)
    streak = 0
    for i in range(len(series) - 1, 0, -1):
        if series[i][1] > series[i - 1][1]:
            streak += 1
        else:
            break
    return streak


def _day_over_day_delta(readings: list[tuple[str, float]]) -> Optional[float]:
    """가장 최근 관측치와, 그로부터 약 24시간 전 관측치의 수온차를 계산한다.
    24시간 전후 ±3시간 이내에 관측치가 없으면(결측) 비교할 수 없어 None."""
    if len(readings) < 2:
        return None
    latest_time = _parse_observed_at(readings[-1][0])
    current_temp = readings[-1][1]
    target = latest_time - timedelta(hours=24)

    closest_time, closest_temp = min(
        readings[:-1], key=lambda r: abs((_parse_observed_at(r[0]) - target).total_seconds())
    )
    if abs((_parse_observed_at(closest_time) - target).total_seconds()) > 3 * 3600:
        return None
    return current_temp - closest_temp


def _project_temperature(readings: list[tuple[str, float]], hours_ahead: float) -> Optional[float]:
    """최근 이력에 1차 선형회귀를 적용해 hours_ahead 시간 뒤 수온을 예측한다.
    서로 다른 시점이 2개 미만이면 예측할 수 없어 None을 반환한다."""
    if len(readings) < 2:
        return None

    base_time = _parse_observed_at(readings[0][0])
    x = np.array([(_parse_observed_at(t) - base_time).total_seconds() / 3600 for t, _ in readings])
    y = np.array([temp for _, temp in readings])

    if np.ptp(x) < 1:  # 관측 시점이 사실상 동일하면 추세를 낼 수 없음
        return None

    slope, intercept = np.polyfit(x, y, 1)
    target_x = x[-1] + hours_ahead
    return float(intercept + slope * target_x)


def classify_station_risk(sta_cde: str, obs_lay: str = "1", species: str = "일반(기본)") -> dict:
    """관측소·수심층 하나에 대한 위험도를 어종별 임계온도 기준으로 산출한다."""
    thresholds = SPECIES_THRESHOLDS.get(species, SPECIES_THRESHOLDS["일반(기본)"])
    warning_temp = thresholds["warning"]
    alert_temp = thresholds["alert"]

    readings = get_recent_readings(sta_cde, obs_lay, hours=HISTORY_WINDOW_HOURS)

    if not readings:
        return {
            "sta_cde": sta_cde,
            "species": species,
            "level": "데이터 부족",
            "current_temp": None,
            "predicted_temp_72h": None,
            "consecutive_days_alert": 0,
            "reason": "관측 이력이 없습니다.",
            "observed_at": None,
            "day_over_day_delta": None,
            "rising_streak_days": 0,
        }

    current_temp = readings[-1][1]
    observed_at = readings[-1][0]
    consecutive_days = _consecutive_days_above(readings, alert_temp)
    predicted_temp = _project_temperature(readings, PROJECTION_HOURS)
    day_over_day_delta = _day_over_day_delta(readings)
    rising_streak_days = _rising_streak_days(readings)

    if consecutive_days >= ALERT_DURATION_DAYS:
        level = "경보"
        reason = f"{alert_temp}℃ 이상이 {consecutive_days}일 연속 관측됨"
    elif current_temp >= alert_temp:
        level = "주의"
        reason = f"현재 수온 {current_temp:.1f}℃로 {alert_temp}℃ 이상"
    elif current_temp >= warning_temp:
        level = "관심"
        reason = f"현재 수온 {current_temp:.1f}℃로 {warning_temp}℃ 이상"
    elif predicted_temp is not None and predicted_temp >= alert_temp:
        level = "관심"
        reason = f"추세상 {PROJECTION_HOURS}시간 내 {predicted_temp:.1f}℃ 도달 예상"
    else:
        level = "정상"
        reason = f"현재 수온 {current_temp:.1f}℃"

    return {
        "sta_cde": sta_cde,
        "species": species,
        "level": level,
        "current_temp": current_temp,
        "predicted_temp_72h": predicted_temp,
        "consecutive_days_alert": consecutive_days,
        "reason": reason,
        "observed_at": observed_at,
        "day_over_day_delta": day_over_day_delta,
        "rising_streak_days": rising_streak_days,
    }


def classify_all_stations(
    station_codes: list[str], obs_lay: str = "1", species: str = "일반(기본)"
) -> list[dict]:
    return [classify_station_risk(code, obs_lay, species) for code in station_codes]
