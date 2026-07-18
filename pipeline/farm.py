"""위경도로 등록한 어장을 가장 가까운 관측소에 자동으로 매핑한다.

기존에는 사용자가 관측소 11개 중 하나를 직접 골라야 했다 — 이건 "내 어장이 어디
붙는지"를 사용자가 스스로 판단해야 하는 부담이자, "선택형 데모"처럼 보이는 원인
중 하나였다. 이 모듈은 위도/경도만 입력받아 최근접 관측소를 계산해, 사용자가
관측소 코드를 몰라도 되게 한다.

주의: 이건 "정확한 좌표 반경 계산"이 아니라 "직선거리 기준 최근접 관측소 근사"다.
실제 해류·지형(만입, 수심)에 따라 물리적으로 가장 가까운 관측소가 수온 특성상 가장
대표성 있는 관측소가 아닐 수 있다 — 이 앱의 다른 근사치들(적조 지명 매칭, 성층화
휴리스틱 등)과 마찬가지로 한계를 그대로 안내한다.
"""

import math
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.collect_kosha import STATION_COORDS, TARGET_STATIONS

EARTH_RADIUS_KM = 6371.0

# 이 거리보다 멀면 "가장 가까운 관측소가 있긴 하지만 대표성이 낮을 수 있다"고
# 경고한다. 관측소 간 평균 간격이 대략 10~30km 수준이라 잡은 임의 기준이다.
FAR_MATCH_WARNING_KM = 15.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 대권거리(직선거리 근사, km)를 계산한다."""
    r1, r2 = math.radians(lat1), math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(r1) * math.cos(r2) * math.sin(d_lon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest_station(lat: float, lon: float) -> dict:
    """입력 좌표에서 가장 가까운 관측소를 찾는다.

    반환값: {"sta_cde", "region", "distance_km", "far_match": bool}
    """
    best_code, best_dist = None, float("inf")
    for code, (s_lat, s_lon) in STATION_COORDS.items():
        dist = haversine_km(lat, lon, s_lat, s_lon)
        if dist < best_dist:
            best_code, best_dist = code, dist

    return {
        "sta_cde": best_code,
        "region": TARGET_STATIONS.get(best_code, ""),
        "distance_km": round(best_dist, 1),
        "far_match": best_dist > FAR_MATCH_WARNING_KM,
    }


if __name__ == "__main__":
    # 통영시청 인근 좌표로 간단 테스트
    result = nearest_station(34.8544, 128.4331)
    print(result)
