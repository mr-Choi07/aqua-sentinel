"""원본 정부 서식(자연재난 피해신고서, 별지 제1호서식)에 데이터를 오버레이한다.

좌표는 docs/form_structure.json에서 추출한 라벨 위치를 기준으로 계산했다
(정리 근거는 docs/damage_report_template.md 참고). "확정", "피해 구분",
융자신청 여부, 신고인 서명, 가족 수/고등학생 수/재난지원금 계좌/도시가스
사용여부/주거 형태, 뒤쪽 페이지(개인정보 동의 서명란) — 이 항목들은 절대
채우지 않는다. build_official_overlay()는 실제로 그린 좌표 목록을 반환하니,
호출측(또는 테스트)에서 금지 구역과 겹치지 않는지 검증할 수 있다.

식별번호(어업면허/신고번호)는 잘못 잘리면 실제와 다른 번호처럼 보여 사실
오인을 유발할 수 있어 말줄임(...) 처리를 절대 하지 않는다. 대신
  1) 6pt까지 폰트를 줄여서 한 줄에 시도
  2) 하이픈 기준으로 끊어서 2줄로 시도
  3) 그래도 안 들어가면 각주 번호만 칸에 남기고, 페이지 하단 여백에
     전체 번호를 온전한 형태로 다시 표기한다.
AI 추정치(피해물량-신고, 피해 원인 요약)는 원래도 근사값이라 말줄임을
허용한다.
"""

import io
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ORIGINAL_FORM_PATH = PROJECT_ROOT / "docs" / "원본서식_자연재난피해신고서.pdf"

KOREAN_FONT = "MalgunOverlay"
KOREAN_FONT_PATH = "C:/Windows/Fonts/malgun.ttf"

PAGE_WIDTH = 595.0
PAGE_HEIGHT = 841.0


def _font_registered() -> bool:
    return KOREAN_FONT in pdfmetrics.getRegisteredFontNames()


def _register_font() -> None:
    if not _font_registered():
        pdfmetrics.registerFont(TTFont(KOREAN_FONT, KOREAN_FONT_PATH))


def _y(bottom: float) -> float:
    """docs/form_structure.json의 top/bottom(페이지 상단 기준)을 reportlab의
    바닥 기준 y로 변환한다."""
    return PAGE_HEIGHT - bottom


# 일반 텍스트 필드 — 말줄임 허용. (성명(대표자), 주소(사업장), 이동전화,
# 피해시설명①, 총면적①, 피해물량-신고①, 피해 원인①)
FIELD_POSITIONS = {
    "owner": {"page": 1, "x": 145, "y": _y(208.1), "max_width": 190, "font": 9},
    "address": {"page": 1, "x": 145, "y": _y(182.5), "max_width": 385, "font": 9},
    "contact": {"page": 1, "x": 158, "y": _y(287.4), "max_width": 86, "font": 8},
    "farm_name": {"page": 1, "x": 176, "y": _y(367.7), "max_width": 54, "font": 6},
    "farm_area_ha": {"page": 1, "x": 176, "y": _y(380.5), "max_width": 54, "font": 6},
    "quantity_estimate": {"page": 1, "x": 176, "y": _y(405.2), "max_width": 54, "font": 6},
    "cause_summary": {"page": 1, "x": 176, "y": _y(442.1), "max_width": 54, "font": 6},
}

# 식별번호 전용 — 말줄임 금지. 셀의 위/아래 경계도 같이 들고 있어야 2줄
# 줄바꿈이 실제로 칸 안에 들어가는지 확인할 수 있다.
LICENSE_NO_FIELD = {
    "page": 1,
    "x": 176,
    "y": _y(393.4),  # 1줄일 때 기준선
    "row_top_y": _y(383.4),
    "row_bottom_y": _y(393.4),
    "max_width": 54,
}

# 절대 채우지 않는 좌표 대역(페이지, y_top, y_bottom) — 검증용으로만 사용.
FORBIDDEN_ZONES = [
    (1, _y(417.0), _y(408.0)),  # 피해물량-확정①
    (1, _y(429.3), _y(420.3)),  # 피해 구분①
    (1, _y(455.3), _y(444.1)),  # 융자신청 여부
    (1, _y(692.9), _y(683.0)),  # 신고인 서명
    (1, _y(220.9), _y(210.9)),  # 가족 수
    (1, _y(238.1), _y(228.2)),  # 고등학생 수
    (1, _y(268.2), _y(248.3)),  # 재난지원금 지급통장 계좌번호
    (1, _y(326.8), _y(316.9)),  # 도시가스 사용여부
    (1, _y(195.4), _y(185.4)),  # 주거 형태
    (2, PAGE_HEIGHT, 0),  # 뒤쪽 페이지 전체(개인정보 동의 서명란 포함)
]

FOOTNOTE_X = 60.8
FOOTNOTE_START_Y = 45  # 페이지 하단 여백(인쇄 영역 밖)
FOOTNOTE_LINE_HEIGHT = 9

WATERMARK_TEXT = "AI 작성 참고용 — 공식 신고서 아님"


@dataclass
class DrawRecord:
    page: int
    x: float
    y: float
    text: str


@dataclass
class OverlayResult:
    output_path: str
    draws: list[DrawRecord] = field(default_factory=list)
    license_no_footnote: str | None = None


def _text_width(text: str, font_size: float) -> float:
    return pdfmetrics.stringWidth(text, KOREAN_FONT, font_size)


def _erase_field_box(
    c: canvas.Canvas, x: float, y: float, width: float, height_above: float, height_below: float = 2.5
) -> tuple[float, float, float, float]:
    """텍스트를 그리기 전에 원본 서식의 대시·밑줄을 흰색으로 덮는다.
    반환값(x0, y0, x1, y1)은 워터마크가 이 영역을 피해가도록 기록해둔다."""
    x0, y0 = x - 2, y - height_below
    x1, y1 = x + width + 3, y + height_above
    c.saveState()
    c.setFillColorRGB(1, 1, 1)
    c.rect(x0, y0, x1 - x0, y1 - y0, fill=1, stroke=0)
    c.restoreState()
    return (x0, y0, x1, y1)


def _fit_font_size(text: str, max_width: float, start_size: float, min_size: float = 5.0) -> float | None:
    """한 줄 기준으로 max_width 안에 들어가는 가장 큰 폰트 크기를 찾는다.
    min_size까지 줄여도 안 들어가면 None."""
    size = start_size
    while size >= min_size:
        if _text_width(text, size) <= max_width:
            return size
        size -= 0.5
    return None


def _draw_fit_or_truncate(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    max_width: float,
    base_font: float,
    draws: list[DrawRecord],
    page: int,
    exclude_zones: list[tuple[float, float, float, float]] | None = None,
) -> None:
    """일반 필드용: 폰트를 줄여보고, 그래도 안 되면 말줄임표로 자른다.
    텍스트를 쓰기 전 칸 전체(max_width) 영역을 흰색으로 덮어 원본의
    대시·밑줄이 겹쳐 보이지 않게 한다."""
    if not text:
        return
    fit_size = _fit_font_size(text, max_width, base_font)
    size = fit_size if fit_size is not None else (base_font if base_font < 6 else 6.0)

    zone = _erase_field_box(c, x, y, max_width, height_above=size + 2.5)
    if exclude_zones is not None:
        exclude_zones.append(zone)

    if fit_size is not None:
        c.setFont(KOREAN_FONT, size)
        c.drawString(x, y, text)
        draws.append(DrawRecord(page, x, y, text))
        return

    truncated = text
    while truncated and _text_width(truncated + "…", size) > max_width:
        truncated = truncated[:-1]
    truncated = (truncated + "…") if truncated != text else text
    c.setFont(KOREAN_FONT, size)
    c.drawString(x, y, truncated)
    draws.append(DrawRecord(page, x, y, truncated))


def _draw_license_no(
    c: canvas.Canvas,
    value: str,
    draws: list[DrawRecord],
    footnote_no: int,
    exclude_zones: list[tuple[float, float, float, float]] | None = None,
) -> str | None:
    """식별번호 전용 — 말줄임 금지. 6pt 축소 → 하이픈 2줄 → 각주 순으로 시도.
    각주가 필요했다면 페이지 하단에 적을 전체 문구를 반환하고, 아니면 None."""
    if not value:
        return None

    pos = LICENSE_NO_FIELD
    page = pos["page"]
    x = pos["x"]
    max_width = pos["max_width"]
    row_height = abs(pos["row_top_y"] - pos["row_bottom_y"])

    # 칸 전체(행 높이만큼)를 먼저 지운다 — 1줄/2줄/각주 어느 경로든 같은 칸이다.
    zone = _erase_field_box(
        c, x, pos["row_bottom_y"], max_width, height_above=row_height + 2.5, height_below=2.5
    )
    if exclude_zones is not None:
        exclude_zones.append(zone)

    # 1) 6pt까지 축소해서 한 줄 시도
    size = _fit_font_size(value, max_width, start_size=8.0, min_size=6.0)
    if size is not None:
        c.setFont(KOREAN_FONT, size)
        c.drawString(x, pos["y"], value)
        draws.append(DrawRecord(page, x, pos["y"], value))
        return None

    # 2) 하이픈 기준 2줄 시도
    if "-" in value:
        parts = value.split("-")
        mid = len(parts) // 2 or 1
        line1 = "-".join(parts[:mid]) + "-"
        line2 = "-".join(parts[mid:])
        size2 = min(
            _fit_font_size(line1, max_width, start_size=7.0, min_size=5.0) or 0,
            _fit_font_size(line2, max_width, start_size=7.0, min_size=5.0) or 0,
        )
        # 두 줄 + 줄간격이 실제 행 높이 안에 들어가는지 확인
        if size2 >= 5.0 and (size2 * 2 + 1.5) <= row_height + 3:  # 약간의 여유(3pt) 허용
            c.setFont(KOREAN_FONT, size2)
            c.drawString(x, pos["y"] + size2 * 0.9, line1)
            c.drawString(x, pos["y"] - size2 * 0.6, line2)
            draws.append(DrawRecord(page, x, pos["y"] + size2 * 0.9, line1))
            draws.append(DrawRecord(page, x, pos["y"] - size2 * 0.6, line2))
            return None

    # 3) 각주 처리 — 칸에는 각주 번호만, 전체 번호는 페이지 하단에 별도 표기
    c.setFont(KOREAN_FONT, 6)
    marker = f"*{footnote_no}"
    c.drawString(x, pos["y"], marker)
    draws.append(DrawRecord(page, x, pos["y"], marker))
    return f"*{footnote_no} 어업면허/신고번호(전체): {value}"


def _rects_overlap(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return ax0 < bx1 and ax1 > bx0 and ay0 < by1 and ay1 > by0


def _watermark_tile_bbox(x: float, y: float, font_size: float) -> tuple[float, float, float, float]:
    """45도 회전된 워터마크 한 칸이 실제로 차지하는 대략적인 사각 영역(비회전 좌표계 기준
    바운딩 박스)을 계산한다. 채운 필드와의 겹침 판정에만 쓰는 근사치라 정밀할 필요는 없다."""
    text_w = pdfmetrics.stringWidth(WATERMARK_TEXT, KOREAN_FONT, font_size)
    corners_local = [(0, -3), (text_w, -3), (text_w, font_size), (0, font_size)]
    cos_a, sin_a = 0.7071067811865476, 0.7071067811865476  # cos(45°), sin(45°)
    xs, ys = [], []
    for lx, ly in corners_local:
        xs.append(x + lx * cos_a - ly * sin_a)
        ys.append(y + lx * sin_a + ly * cos_a)
    return (min(xs), min(ys), max(xs), max(ys))


def _draw_watermark(
    c: canvas.Canvas, exclude_zones: list[tuple[float, float, float, float]] | None = None
) -> None:
    """빈 여백에는 또렷이 보이되, 데이터를 채운 8개 필드 영역과는 겹치지 않게 그린다."""
    font_size = 22
    exclude_zones = exclude_zones or []
    # 겹침 판정에 약간의 여유(패딩)를 둬서 글자 바로 옆에 워터마크가 바짝 붙지 않게 한다.
    padded_zones = [(x0 - 4, y0 - 4, x1 + 4, y1 + 4) for x0, y0, x1, y1 in exclude_zones]

    c.saveState()
    c.setFont(KOREAN_FONT, font_size)
    c.setFillColorRGB(0.6, 0.1, 0.1)
    try:
        c.setFillAlpha(0.10)  # 15%대 → 8~10%로 낮춤(빈 공간에서는 여전히 또렷이 보임)
    except AttributeError:
        pass  # 구버전 reportlab은 알파를 지원하지 않을 수 있음 — 그래도 워터마크 자체는 그려짐
    for row in range(4):
        for col in range(3):
            x = 40 + col * 220
            y = 60 + row * 220
            tile_bbox = _watermark_tile_bbox(x, y, font_size)
            if any(_rects_overlap(tile_bbox, z) for z in padded_zones):
                continue
            c.saveState()
            c.translate(x, y)
            c.rotate(45)
            c.drawString(0, 0, WATERMARK_TEXT)
            c.restoreState()
    c.restoreState()


def build_official_overlay(
    output_path: str,
    farm_info: dict,
    ai_analysis,
) -> OverlayResult:
    """원본 서식 위에 데이터를 오버레이한 PDF를 생성한다.

    farm_info: {
        "owner": str,           # 어업인명 → 성명(대표자)
        "contact": str,         # 연락처 → 이동전화
        "region": str,          # 어장 소재지 → 주소(사업장)
        "farm_name": str,       # 어장명 → 피해시설명①
        "farm_area_ha": str,    # 양식 면적(ha) → 총면적①
        "license_no": str,      # 어업면허/신고번호 → 면허·허가·등록번호① (말줄임 금지)
    }
    ai_analysis: pipeline.damage_report.PhotoAnalysis
        (quantity_estimate → 피해물량-신고①, cause_estimate 요약 → 피해 원인①)
    """
    if not ORIGINAL_FORM_PATH.exists():
        raise FileNotFoundError(f"원본 서식을 찾을 수 없습니다: {ORIGINAL_FORM_PATH}")

    _register_font()

    reader = PdfReader(str(ORIGINAL_FORM_PATH))
    num_pages = len(reader.pages)

    draws: list[DrawRecord] = []
    footnote_lines: list[str] = []
    footnote_counter = 1
    field_zones: list[tuple[float, float, float, float]] = []  # 워터마크가 피해가야 할 영역

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))

    for page_no in range(1, num_pages + 1):
        if page_no == 1:
            c.setFont(KOREAN_FONT, 9)

            f = FIELD_POSITIONS["owner"]
            _draw_fit_or_truncate(
                c, farm_info.get("owner", ""), f["x"], f["y"], f["max_width"], f["font"], draws, 1, field_zones
            )

            f = FIELD_POSITIONS["address"]
            _draw_fit_or_truncate(
                c, farm_info.get("region", ""), f["x"], f["y"], f["max_width"], f["font"], draws, 1, field_zones
            )

            f = FIELD_POSITIONS["contact"]
            _draw_fit_or_truncate(
                c, farm_info.get("contact", ""), f["x"], f["y"], f["max_width"], f["font"], draws, 1, field_zones
            )

            f = FIELD_POSITIONS["farm_name"]
            _draw_fit_or_truncate(
                c, farm_info.get("farm_name", ""), f["x"], f["y"], f["max_width"], f["font"], draws, 1, field_zones
            )

            f = FIELD_POSITIONS["farm_area_ha"]
            _draw_fit_or_truncate(
                c,
                str(farm_info.get("farm_area_ha", "")),
                f["x"],
                f["y"],
                f["max_width"],
                f["font"],
                draws,
                1,
                field_zones,
            )

            note = _draw_license_no(c, farm_info.get("license_no", ""), draws, footnote_counter, field_zones)
            if note:
                footnote_lines.append(note)
                footnote_counter += 1

            f = FIELD_POSITIONS["quantity_estimate"]
            _draw_fit_or_truncate(
                c, ai_analysis.quantity_estimate, f["x"], f["y"], f["max_width"], f["font"], draws, 1, field_zones
            )

            f = FIELD_POSITIONS["cause_summary"]
            cause_short = ai_analysis.cause_estimate[:15]
            _draw_fit_or_truncate(c, cause_short, f["x"], f["y"], f["max_width"], f["font"], draws, 1, field_zones)
            footnote_lines.append("* 피해 원인(AI, 요약) 상세 근거는 신고서 초안 참고자료를 확인하세요.")

            if footnote_lines:
                c.setFont(KOREAN_FONT, 6)
                c.setFillColorRGB(0.35, 0.35, 0.35)
                fy = FOOTNOTE_START_Y
                for line in footnote_lines:
                    c.drawString(FOOTNOTE_X, fy, line)
                    fy += FOOTNOTE_LINE_HEIGHT
                c.setFillColorRGB(0, 0, 0)

        _draw_watermark(c, field_zones if page_no == 1 else None)
        c.showPage()

    c.save()
    buf.seek(0)

    overlay_reader = PdfReader(buf)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        page.merge_page(overlay_reader.pages[i])
        writer.add_page(page)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        writer.write(f)

    return OverlayResult(
        output_path=output_path,
        draws=draws,
        license_no_footnote=footnote_lines[0] if footnote_lines and footnote_lines[0].startswith("*1") else None,
    )


if __name__ == "__main__":
    print("이 모듈은 farm_info와 ai_analysis(PhotoAnalysis)를 받아 build_official_overlay()로 호출하세요.")
