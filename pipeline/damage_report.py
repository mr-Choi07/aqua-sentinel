"""폐사 사진 분석 + 피해 상황 정리 보고서(PDF) 자동 생성.

주의: 여기서 생성하는 PDF는 지자체에 제출하는 공식 피해신고서 양식이 아니라,
어업인이 실제 신고를 준비할 때 참고할 수 있는 "피해 상황 정리 보고서(초안)"이다.
실제 신고는 관할 시·군·구 수산부서에 별도로 접수해야 한다(TODO: 지자체별 공식
신고 서식이 확인되면 양식을 맞춰서 보완할 것).

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


class _ReportPDF(FPDF):
    def header(self):
        self.set_font("Malgun", "B", 14)
        self.cell(0, 10, "어장 피해 상황 정리 보고서 (초안)", ln=True, align="C")
        self.set_font("Malgun", "", 9)
        self.set_text_color(120, 120, 120)
        self.cell(
            0,
            6,
            "본 문서는 실제 신고 서식이 아니며, 어업인의 신고 준비를 돕기 위한 참고 자료입니다.",
            ln=True,
            align="C",
        )
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
    pdf.cell(40, 7, label)
    pdf.multi_cell(PAGE_CONTENT_WIDTH - 40, 7, str(value) if value not in (None, "") else "-")
    pdf.set_x(pdf.l_margin)


def build_damage_report(
    output_path: str,
    farm_info: dict,
    risk_context: dict,
    ai_analysis: str,
    photo_path: str | None = None,
) -> str:
    """피해 상황 정리 보고서를 PDF로 생성한다.

    farm_info: {"owner": str, "farm_name": str, "region": str, "species": str}
    risk_context: {"level": str, "current_temp": float, "reason": str}
    """
    pdf = _ReportPDF()
    _register_fonts(pdf)
    pdf.add_page()

    _section_title(pdf, "1. 어장 정보")
    _field(pdf, "어업인명", farm_info.get("owner"))
    _field(pdf, "어장명", farm_info.get("farm_name"))
    _field(pdf, "지역", farm_info.get("region"))
    _field(pdf, "양식 어종", farm_info.get("species"))
    _field(pdf, "작성일시", datetime.now().strftime("%Y-%m-%d %H:%M"))
    pdf.ln(4)

    _section_title(pdf, "2. 관측 데이터 기반 위험도")
    _field(pdf, "위험도 등급", risk_context.get("level"))
    _field(pdf, "관측 수온", f"{risk_context.get('current_temp')}℃")
    _field(pdf, "판단 근거", risk_context.get("reason"))
    pdf.ln(4)

    _section_title(pdf, "3. 폐사 사진 AI 소견")
    pdf.multi_cell(PAGE_CONTENT_WIDTH, 7, ai_analysis or "-")
    pdf.set_x(pdf.l_margin)
    pdf.ln(4)

    if photo_path and os.path.exists(photo_path):
        _section_title(pdf, "4. 첨부 사진")
        pdf.image(photo_path, w=100)
        pdf.set_x(pdf.l_margin)
        pdf.ln(4)

    _section_title(pdf, "5. 안내")
    pdf.set_font("Malgun", "", 9)
    pdf.multi_cell(
        PAGE_CONTENT_WIDTH,
        6,
        "이 보고서는 실제 피해 신고서가 아닙니다. 정식 신고는 관할 시·군·구 "
        "수산부서에 별도로 접수하시기 바라며, AI 소견은 참고용으로만 사용하고 "
        "최종 피해 원인 판정은 전문가 확인을 거쳐야 합니다.",
    )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    pdf.output(output_path)
    return output_path


if __name__ == "__main__":
    print("이 모듈은 app에서 photo_path와 함께 호출하세요. 단독 실행용 예시는 없습니다.")
