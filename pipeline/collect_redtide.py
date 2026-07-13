"""
국립수산과학원(NIFS) 적조정보 API 수집.

엔드포인트: https://www.nifs.go.kr/OpenAPI_json?id=redtideList&key=<서비스키>&sdate=<yyyymmdd>&edate=<yyyymmdd>

주의: 공식 API 명세서(PDF)에 문서화된 필드명과 실제 응답 필드명이 다르다.
      아래는 2026-07-13 실제 호출로 확인한 응답 구조를 기준으로 작성했다.

응답 구조 예시:
{
  "header": {"resultCode": "00", "resultMsg": "success"},
  "body": {
    "item": [
      {
        "cod_news": "20260618-002",   # 속보코드 (문서상 srcode)
        "day_report": "20260618",      # 조사일시 (문서상 rdate)
        "item2": [
          {
            "nam_biology": "Akashiwo sanguinea",  # 원인생물 (문서상 dname)
            "txt_seas": "산양읍 풍화리 월명도 북측 및 장군봉 내만",  # 조사해역 (문서상 oarea)
            "min_density": "0.7",     # 생물밀도 min (문서상 sdensity)
            "max_density": "142",     # 생물밀도 max (문서상 edensity)
            "min_watertemp": "20.2",  # 수온 min (문서상 swt)
            "max_watertemp": "21.6",  # 수온 max (문서상 ewt)
            "min_salt": "",
            "max_salt": ""
          }
        ]
      }, ...
    ]
  }
}

TODO: 대상 지역(통영·거제·남해·고성·하동) 필터링은 txt_seas(조사해역) 문자열에
      지역명이 포함되는지로 판단한다. 행정구역명이 아니라 "산양읍", "화양면"처럼
      읍/면 단위로만 표기되는 경우가 있어 완전한 필터링은 안 될 수 있음 — 결과를
      보고 지역명 매칭 목록을 보완할 것.
"""

import os
from datetime import datetime, timedelta

import pandas as pd
import requests

NIFS_REDTIDE_API_URL = "https://www.nifs.go.kr/OpenAPI_json"

# 조사해역(txt_seas) 문자열에 포함되면 대상 지역으로 간주할 키워드
TARGET_REGION_KEYWORDS = ["통영", "거제", "남해", "고성", "하동", "산양읍", "장군봉"]


def get_api_key() -> str:
    """.env 에서 NIFS_REDTIDE_API_KEY 를 읽어온다."""
    api_key = os.environ.get("NIFS_REDTIDE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "NIFS_REDTIDE_API_KEY 환경변수가 설정되지 않았습니다. "
            ".env 파일에 국립수산과학원 Open API 서비스 키를 넣어주세요."
        )
    return api_key


def fetch_redtide_info(days_back: int = 30) -> list[dict]:
    """최근 days_back 일간의 적조 속보를 조회해 평탄화된 레코드 목록으로 반환한다."""
    api_key = get_api_key()
    edate = datetime.now().strftime("%Y%m%d")
    sdate = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")

    response = requests.get(
        NIFS_REDTIDE_API_URL,
        params={"id": "redtideList", "key": api_key, "sdate": sdate, "edate": edate},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    result_code = payload.get("header", {}).get("resultCode")
    if result_code != "00":
        raise RuntimeError(f"API 오류 응답: {payload.get('header')}")

    records = []
    for entry in payload.get("body", {}).get("item", []):
        for detail in entry.get("item2", []):
            records.append(
                {
                    "cod_news": entry.get("cod_news"),
                    "day_report": entry.get("day_report"),
                    **detail,
                }
            )
    return records


def filter_target_region(records: list[dict]) -> list[dict]:
    """조사해역(txt_seas)에 대상 지역 키워드가 포함된 레코드만 필터링한다."""
    return [
        r
        for r in records
        if any(keyword in r.get("txt_seas", "") for keyword in TARGET_REGION_KEYWORDS)
    ]


def save_to_csv(records: list[dict], output_dir: str = "data") -> str:
    """수집한 데이터를 /data 에 타임스탬프가 포함된 CSV로 저장한다."""
    df = pd.DataFrame(records)

    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(output_dir, f"redtide_{timestamp}.csv")
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    return output_path


if __name__ == "__main__":
    all_records = fetch_redtide_info()
    target_records = filter_target_region(all_records)
    output_path = save_to_csv(target_records if target_records else all_records)
    print(
        f"[{datetime.now()}] 전체 {len(all_records)}건 중 대상 지역 {len(target_records)}건 "
        f"-> {output_path}"
    )
