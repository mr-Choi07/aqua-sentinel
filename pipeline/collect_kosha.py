"""
국립수산과학원(NIFS) 실시간어장정보 API(수온) 수집.

엔드포인트: https://www.nifs.go.kr/OpenAPI_json?id=risaList&key=<서비스키>
(data.go.kr이 아니라 국립수산과학원 자체 Open API 포털에서 발급받은 키를 사용한다.)

응답 구조 예시:
{
  "header": {"resultCode": "00", "resultMsg": "success"},
  "body": {
    "item": [
      {
        "sta_cde": "eng5c",      # 관측소 코드
        "sta_nam_kor": "남해 강진",  # 관측소명
        "obs_dat": "2026-07-13",  # 관측일자
        "obs_tim": "15:30:00",    # 관측시각
        "obs_lay": "1",           # 관측 층(수심 레이어)
        "wtr_tmp": "17.4",        # 수온(℃)
        "repair_gbn": "1",
        "rpr_yn": "N"
      }, ...
    ]
  }
}

id=risaList 호출은 관측소별 파라미터 없이 전국 관측소 데이터를 한 번에 반환하므로,
필요한 지역만 응답에서 필터링해서 사용한다.

TODO: 하동은 이 API 응답에 해당 관측소가 없음(패류양식 위주 지역이라 그런 것으로
      추정). 하동 데이터가 필요하면 별도 API(예: 패류 생산단지 수질정보)를
      추가로 확인할 것.

관측소 좌표(STATION_COORDS)는 risaList가 아니라 별도 관측소 메타데이터 조회
(https://www.nifs.go.kr/risa/risa/risaC/searchRisaStationList.do, POST)에서
가져왔다 — risaList 응답에는 좌표 필드가 없다. 이 메타데이터 조회 결과, "고성 가진"
(fggo3)의 좌표가 위도 38.37°N/경도 128.52°E(강원도 고성 인근, 동해 그룹)로 나와
있는데, 이는 우리가 다루는 경남 고성(남해안)과 명백히 다른 위치라 NIFS 측 데이터
품질 문제로 보인다(다른 10개 관측소는 모두 위도 34.7~34.9°N 범위로 자연스럽게
군집돼 있는데 이 항목만 동떨어짐). 그래서 fggo3만 위키데이터(Q50208)의 경상남도
고성군 행정구역 중심 좌표로 대체했다 — 관측소 자체 좌표가 아니라 군 단위 근사치이니
정밀도가 다른 10곳보다 낮다는 점을 명시해둔다.
"""

import os
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.db import insert_readings

load_dotenv()

NIFS_REALTIME_TEMP_API_URL = "https://www.nifs.go.kr/OpenAPI_json"

# 통영·거제·남해·고성 인근 관측소 코드 (2026-07-13 기준 risaList 응답에서 확인)
TARGET_STATIONS = {
    "eng5c": "남해 강진",
    "fnm5b": "남해 미조",
    "fgg4c": "거제 가배",
    "gi086": "거제 일운",
    "fggo3": "고성 가진",
    "fth59": "통영 학림",
    "ftp4c": "통영 풍화",
    "ftsj3": "통영 수월",
    "tb087": "통영 비산도",
    "ty004": "통영 영운",
    "ty005": "통영 사량",
}

# (위도, 경도) — 출처는 위 모듈 docstring 참고. fggo3는 관측소 자체 좌표가 아니라
# 경남 고성군 행정구역 중심 근사치(정밀도 낮음, 아래 주석 참고).
STATION_COORDS: dict[str, tuple[float, float]] = {
    "eng5c": (34.8746, 127.9522),
    "fnm5b": (34.7255, 128.0497),
    "fgg4c": (34.7851, 128.5664),
    "gi086": (34.8038, 128.7094),
    "fggo3": (34.9728, 128.3236),  # 근사치 — 경남 고성군 행정구역 중심(위키데이터 Q50208)
    "fth59": (34.7498, 128.4151),
    "ftp4c": (34.8348, 128.3353),
    "ftsj3": (34.8222, 128.3450),
    "tb087": (34.8082, 128.4951),
    "ty004": (34.7904, 128.4293),
    "ty005": (34.8022, 128.2463),
}


def get_api_key() -> str:
    """.env 에서 NIFS_TEMP_API_KEY 를 읽어온다."""
    api_key = os.environ.get("NIFS_TEMP_API_KEY")
    if not api_key:
        raise RuntimeError(
            "NIFS_TEMP_API_KEY 환경변수가 설정되지 않았습니다. "
            ".env 파일에 국립수산과학원 Open API 서비스 키를 넣어주세요."
        )
    return api_key


def fetch_realtime_temperature() -> list[dict]:
    """전국 관측소 실시간 수온 데이터를 조회하고 대상 지역만 필터링해 반환한다."""
    api_key = get_api_key()
    response = requests.get(
        NIFS_REALTIME_TEMP_API_URL,
        params={"id": "risaList", "key": api_key},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    result_code = payload.get("header", {}).get("resultCode")
    if result_code != "00":
        raise RuntimeError(f"API 오류 응답: {payload.get('header')}")

    items = payload.get("body", {}).get("item", [])
    return [item for item in items if item.get("sta_cde") in TARGET_STATIONS]


def save_to_csv(records: list[dict], output_dir: str = "data") -> str:
    """수집한 데이터를 /data 에 타임스탬프가 포함된 CSV로 저장한다."""
    df = pd.DataFrame(records)
    df["region"] = df["sta_cde"].map(TARGET_STATIONS)

    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(output_dir, f"wtr_tmp_{timestamp}.csv")
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    return output_path


if __name__ == "__main__":
    records = fetch_realtime_temperature()
    output_path = save_to_csv(records)
    inserted = insert_readings(records, TARGET_STATIONS)
    print(
        f"[{datetime.now()}] {len(records)}건 수집 완료 -> {output_path} "
        f"(DB 신규 이력 {inserted}건)"
    )
