"""build_official_overlay() 결과를 검증한다.

pdftotext(Poppler)가 설치되어 있지 않아도 동작하도록 pypdf.extract_text()만
사용한다. 검증 항목:

1) 채워야 할 값들이 실제로 draw 목록에 있는지 (오버레이가 빠짐없이 그려졌는지)
2) 식별번호(어업면허/신고번호)에 말줄임표(…)가 절대 없는지
3. 어떤 draw도 금지 구역(FORBIDDEN_ZONES — 확정/피해구분/융자신청/서명/
   가족수 등/뒤쪽 페이지)과 겹치지 않는지
4. 참고용으로 pypdf 텍스트 추출 결과에 채운 값이 실제로 보이는지
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pypdf import PdfReader

from pipeline.damage_report_official import FORBIDDEN_ZONES, DrawRecord, OverlayResult


def verify(result: OverlayResult, farm_info: dict, ai_analysis) -> list[str]:
    """문제를 발견하면 설명 문자열 리스트를 반환한다. 비어 있으면 통과."""
    problems: list[str] = []

    # 1) 채운 값이 draw 목록에 실제로 있는지
    drawn_texts = " ".join(d.text for d in result.draws)
    expected = {
        "어업인명": farm_info.get("owner", ""),
        "어장 소재지": farm_info.get("region", ""),
        "어장명": farm_info.get("farm_name", ""),
    }
    for label, value in expected.items():
        if value and value not in drawn_texts:
            problems.append(f"'{label}' 값('{value}')이 draw 목록에서 발견되지 않음")

    # 2) 식별번호에 말줄임표가 없는지 — footnote로 빠졌으면 각주 텍스트 쪽에
    #    전체 번호가 온전히 있어야 하고, 칸에는 "*n" 마커만 있어야 한다.
    license_no = farm_info.get("license_no", "")
    if license_no:
        license_draws = [d for d in result.draws if license_no in d.text or d.text.startswith("*")]
        truncated = [d for d in result.draws if "…" in d.text and any(ch.isdigit() for ch in d.text)]
        if truncated:
            problems.append(f"식별번호로 보이는 텍스트에 말줄임표가 사용됨: {truncated}")
        if result.license_no_footnote:
            if license_no not in result.license_no_footnote:
                problems.append("각주로 빠졌는데 전체 번호가 각주 문구에 없음")
        else:
            full_present = any(d.text == license_no for d in result.draws)
            if not full_present:
                # 2줄 분할된 경우일 수 있으니 각 조각이 다 포함되는지 재확인
                parts = license_no.split("-")
                mid = len(parts) // 2 or 1
                line1 = "-".join(parts[:mid]) + "-"
                line2 = "-".join(parts[mid:])
                if not any(d.text == line1 for d in result.draws) or not any(d.text == line2 for d in result.draws):
                    problems.append("식별번호가 온전한 형태(1줄 또는 2줄 분할)로 그려지지 않음")

    # 3) 금지 구역과 겹치는 draw가 있는지
    for d in result.draws:
        for page, y_top, y_bottom, *_ in [(z[0], max(z[1], z[2]), min(z[1], z[2])) for z in FORBIDDEN_ZONES]:
            if d.page == page and y_bottom <= d.y <= y_top:
                problems.append(f"금지 구역 침범: page={d.page} y={d.y} text='{d.text}'")

    # 4) pypdf 텍스트 추출로 참고 확인 (레이아웃 보장은 안 되지만 최소 확인용)
    reader = PdfReader(result.output_path)
    full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    for label, value in expected.items():
        if value and value not in full_text:
            problems.append(f"[참고] pypdf 텍스트 추출에서 '{label}' 값을 못 찾음 (렌더링 방식 차이일 수 있음)")

    return problems


if __name__ == "__main__":
    from pipeline.damage_report import PhotoAnalysis
    from pipeline.damage_report_official import build_official_overlay

    farm_info = {
        "owner": "홍길동",  # 합성 테스트 데이터 — 실제 인물 아님
        "contact": "010-0000-0000",
        "region": "경남 남해군 예시로 123",
        "farm_name": "테스트 어장",
        "farm_area_ha": "2.5",
        "license_no": "000-000-0000-00000",  # 일부러 길게 만들어 각주 경로도 같이 검증
    }
    analysis = PhotoAnalysis(
        quantity_estimate="수십 마리 이상 추정, 정확한 수량은 추가 확인 필요",
        cause_estimate="고수온 또는 적조로 추정, 전문가 확인 필요",
        full_observation="사진에서 폐사 개체가 다수 관찰됨. 전문가 확인 필요.",
    )

    result = build_official_overlay(
        output_path="data/_test_official_report.pdf",
        farm_info=farm_info,
        ai_analysis=analysis,
    )

    problems = verify(result, farm_info, analysis)
    if problems:
        print("검증 실패:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    else:
        print(f"검증 통과 — {result.output_path}")
        if result.license_no_footnote:
            print("각주 경로 사용됨:", result.license_no_footnote)
