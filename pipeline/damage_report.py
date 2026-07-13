"""폐사 사진 분석 + 피해 상황 정리 보고서(PDF) 자동 생성.

항목 구조는 「자연재난 구호 및 복구 비용 부담기준 등에 관한 규정」[별지 제1호서식]
자연재난 피해신고서(law.go.kr, 개정 2018.7.24)를 기준으로 어업 피해에 필요한 항목만
선별해 매핑했다 — 상세 매핑 근거는 docs/damage_report_template.md 참고.

이 서식은 범용 자연재난 서식(어업 전용 아님)이며, 여기서 생성하는 PDF는 지자체에
제출하는 공식 피해신고서가 아니라 어업인이 실제 신고를 준비할 때 참고하는 문서다.
실제 신고는 관할 시·군·구/읍·면·동에 원본 서식으로 접수해야 한다.

원 서식의 "피해물량-확정"과 "피해구분"란은 작성방법상 담당 공무원이 현지 확인 후
기재하는 항목이므로, 이 시스템은 그 두 칸을 절대 채우지 않고 항상 공란 + 안내
문구로 남긴다. 시스템이 채우는 건 "피해물량-신고"(AI 추정치)와 "피해원인"(AI 참고
소견)까지다.

사진 분석은 Claude Haiku 4.5의 비전 기능을 사용한다. 폐사 원인을 확정 진단하는
것이 아니라, 사진에서 관찰되는 소견을 서술하는 보조 도구로만 사용해야 한다.
"""

import base64
import os
import sys
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from fpdf import FPDF

sys.path.append(str(Path(__file__).resolve().parent.parent))

load_dotenv()

MODEL = "claude-haiku-4-5"

KOREAN_FONT_REGULAR = "C:/Windows/Fonts/malgun.ttf"
KOREAN_FONT_BOLD = "C:/Windows/Fonts/malgunbd.ttf"

ANALYSIS_SYSTEM_PROMPT = """당신은 양식 어업 피해 사진을 검토하는 보조 도구입니다.
사진에서 관찰되는 소견(폐사 개체 수 추정, 외관상 특징, 사육 환경 상태 등)을 객관적으로
서술하세요. 폐사 원인을 단정적으로 진단하지 말고, "고수온/적조로 추정됨" 같은 표현으로
가능성만 언급하세요. 최종 원인 판정은 전문가 확인이 필요하다는 점을 답변 끝에 명시하세요.
3~5문장으로 간결하게 작성하세요."""

# 관측 위험도가 "정상"인데 사진 소견에 대량 폐사를 시사하는 표현이 있으면 불일치로
# 간주한다. 키워드 매칭 휴리스틱이라 정교하지 않다 — 없다고 피해가 없는 것도, 있다고
# 반드시 심각한 것도 아니다(docs/damage_report_template.md 5장 참고).
MASS_MORTALITY_KEYWORDS = ["대량", "다수", "폐사체", "떼죽음", "집단 폐사"]


def get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. "
            ".env 파일에 Anthropic API 키를 넣어주세요."
        )
    return anthropic.Anthropic(api_key=api_key)


def _guess_media_type(image_path: str) -> str:
    ext = Path(image_path).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")


def analyze_damage_photo(image_path: str, species: str, region: str) -> str:
    """폐사 사진을 분석해 소견 텍스트를 반환한다."""
    client = get_client()

    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": _guess_media_type(image_path),
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": f"양식 어종: {species}\n지역: {region}\n이 사진을 분석해줘.",
                    },
                ],
            }
        ],
    )
    return next((block.text for block in response.content if block.type == "text"), "")


def detect_inconsistency(risk_level: str, ai_analysis: str) -> bool:
    """관측 위험도가 정상인데 사진 소견이 대량 폐사를 시사하면 True를 반환한다."""
    if risk_level != "정상":
        return False
    return any(keyword in (ai_analysis or "") for keyword in MASS_MORTALITY_KEYWORDS)


class _ReportPDF(FPDF):
    def header(self):
        self.set_font("Malgun", "B", 14)
        self.cell(0, 10, "어장 피해 상황 정리 보고서 (초안)", ln=True, align="C")
        self.set_font("Malgun", "", 8)
        self.set_text_color(120, 120, 120)
        # 한 줄로 붙이면 A4 폭을 넘겨 양쪽이 잘리므로 두 줄로 나눈다.
        self.cell(0, 5, "본 문서는 실제 자연재난 피해신고서 양식이 아니며, 신고 전 참고자료입니다.", ln=True, align="C")
        self.cell(0, 5, "정식 신고는 관할 시·군·구/읍면동 사무소에 원본 서식으로 접수해야 합니다.", ln=True, align="C")
        self.set_text_color(0, 0, 0)
        self.ln(4)


def _register_fonts(pdf: FPDF) -> None:
    pdf.add_font("Malgun", "", KOREAN_FONT_REGULAR)
    pdf.add_font("Malgun", "B", KOREAN_FONT_BOLD)


def _section_title(pdf: FPDF, title: str) -> None:
    pdf.set_font("Malgun", "B", 12)
    pdf.cell(0, 8, title, ln=True)
    pdf.set_font("Malgun", "", 10)


PAGE_CONTENT_WIDTH = 190  # A4 기준, 좌우 여백 10mm씩 제외


def _field(pdf: FPDF, label: str, value: str) -> None:
    # multi_cell 이후 커서가 오른쪽에 남는 fpdf2 기본 동작 때문에 다음 필드가 페이지
    # 밖으로 밀려나는 걸 막기 위해, 매 필드 시작 시 왼쪽 여백으로 명시적으로 되돌린다.
    pdf.set_x(pdf.l_margin)
    pdf.cell(45, 7, label)
    pdf.multi_cell(PAGE_CONTENT_WIDTH - 45, 7, str(value) if value not in (None, "") else "-")
    pdf.set_x(pdf.l_margin)


def _official_only_field(pdf: FPDF, label: str) -> None:
    """공무원 현지확인 전용 항목 — 시스템은 절대 값을 채우지 않는다."""
    pdf.set_x(pdf.l_margin)
    pdf.cell(45, 7, label)
    pdf.set_text_color(140, 100, 0)
    pdf.multi_cell(PAGE_CONTENT_WIDTH - 45, 7, "(공란 — 담당 공무원 현지확인 후 기재)")
    pdf.set_text_color(0, 0, 0)
    pdf.set_x(pdf.l_margin)


def build_damage_report(
    output_path: str,
    farm_info: dict,
    risk_context: dict,
    ai_analysis: str,
    photo_path: str | None = None,
) -> str:
    """피해 상황 정리 보고서를 PDF로 생성한다.

    farm_info: {
        "owner": str,           # 어업인명
        "contact": str,         # 연락처
        "region": str,          # 어장 소재지
        "farm_name": str,       # 어장명
        "farm_area_ha": str,    # 양식 면적(ha)
        "license_no": str,      # 어업면허/신고번호
        "species": str,
    }
    risk_context: {"level": str, "current_temp": float, "reason": str}
    """
    pdf = _ReportPDF()
    _register_fonts(pdf)
    pdf.add_page()

    if detect_inconsistency(risk_context.get("level"), ai_analysis):
        pdf.set_font("Malgun", "B", 11)
        pdf.set_text_color(180, 40, 40)
        pdf.multi_cell(
            PAGE_CONTENT_WIDTH,
            7,
            # Malgun 폰트에 U+26A0(⚠) 글리프가 없어 렌더링 시 사라진다 — 폰트가
            # 지원하는 문자만 사용한다.
            "[경고] 관측 수온과 사진 소견이 다릅니다. 즉시 신고를 권장합니다.",
        )
        pdf.set_text_color(0, 0, 0)
        pdf.set_x(pdf.l_margin)
        pdf.ln(2)

    _section_title(pdf, "1. 어업인 정보")
    _field(pdf, "어업인명", farm_info.get("owner"))
    _field(pdf, "어장 소재지", farm_info.get("region"))
    _field(pdf, "연락처", farm_info.get("contact"))
    pdf.ln(4)

    _section_title(pdf, "2. 피해 내용")
    _field(pdf, "어장명", farm_info.get("farm_name"))
    _field(pdf, "양식 어종", farm_info.get("species"))
    _field(pdf, "양식 면적(ha)", farm_info.get("farm_area_ha"))
    _field(pdf, "어업면허/신고번호", farm_info.get("license_no"))
    _field(pdf, "피해물량-신고(AI)", ai_analysis or "-")
    _official_only_field(pdf, "피해물량-확정")
    _official_only_field(pdf, "피해 구분")
    _field(pdf, "피해 원인(AI)", ai_analysis or "-")
    pdf.ln(4)

    _section_title(pdf, "3. 관측 데이터 기반 판단")
    _field(pdf, "위험도 등급", risk_context.get("level"))
    _field(pdf, "관측 수온", f"{risk_context.get('current_temp')}℃")
    _field(pdf, "판단 근거", risk_context.get("reason"))
    pdf.ln(4)

    _section_title(pdf, "4. 사진 기반 AI 소견")
    pdf.multi_cell(PAGE_CONTENT_WIDTH, 7, ai_analysis or "-")
    pdf.set_x(pdf.l_margin)
    pdf.ln(4)

    if photo_path and os.path.exists(photo_path):
        _section_title(pdf, "5. 첨부 사진")
        pdf.image(photo_path, w=100)
        pdf.set_x(pdf.l_margin)
        pdf.ln(4)

    _section_title(pdf, "6. 안내")
    pdf.set_font("Malgun", "B", 9)
    pdf.multi_cell(
        PAGE_CONTENT_WIDTH,
        6,
        "본 문서는 실제 자연재난 피해신고서 양식이 아니며, 신고 전 참고자료입니다. "
        "정식 신고는 관할 시·군·구/읍면동 사무소에 원본 서식으로 접수해야 합니다. "
        "'피해물량-확정'과 '피해 구분'은 담당 공무원의 현지 확인이 필요한 항목으로, "
        "AI가 임의로 판정하지 않습니다.",
    )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    pdf.output(output_path)
    return output_path


if __name__ == "__main__":
    print("이 모듈은 app에서 photo_path와 함께 호출하세요. 단독 실행용 예시는 없습니다.")
