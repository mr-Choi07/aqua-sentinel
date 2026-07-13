"""LLM 기반 고수온·적조 대응 코치.

Claude Haiku 4.5를 사용한다 — 매뉴얼을 참고해 대응 문구를 다듬는 수준의 작업이라
저비용 모델로 충분하고, 아래 SYSTEM_PROMPT(공식 대응요령)를 프롬프트 캐싱해두면
반복 호출 비용을 더 낮출 수 있다.

공식 대응요령 출처:
  - 해양수산부 보도자료 "올여름 고수온·적조 단계별로 대응한다"
    (https://www.mof.go.kr/doc/ko/selectDoc.do?docSeq=57204&menuSeq=971&bbsSeq=10)
  - 포항시 "고수온 대응요령"
    (https://www.pohang.go.kr//dept/contents.do?mid=0402030000)

주의: 패류양식(굴·전복·멍게)에 대한 공식 어종별 세부 대응요령은 위 출처에 명시되어
있지 않다(TODO). 현재는 해상가두리(어류) 양식장 기준 조치사항만 근거가 확실하며,
그 외 어종은 공통 조치사항 위주로 안내한다.
"""

import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parent.parent))

load_dotenv()

MODEL = "claude-haiku-4-5"

OFFICIAL_GUIDANCE = """
[고수온 특보 기준]
- 고수온 예비특보: 수온 25도 도달이 예상되는 해역에 발표
- 고수온 주의보: 수온 28도 이상
- 고수온 경보: 수온 28도 이상이 3일 이상 지속(또는 지속 예상), 또는 전일 대비 5도 이상 급상승

[공통 조치사항 — 모든 양식장]
- 국립수산과학원 홈페이지 등에서 실시간 수온 확인 및 사육 수온 조사
- 먹이(사료) 공급 중단
- 조기 출하 검토

[해상가두리(어류) 양식장 조치사항]
- 액화산소공급장치, 저층해수공급장치, 산소발생기, 에어컴프레셔 등 대응장비 총력 가동
- 차광막 설치
- 가두리 그물 침하(수온이 낮은 아래층으로 이동)

[피해 발생 시]
- 관할 지자체(시·군·구)에 즉시 신고
- 신속한 폐사체 처리
""".strip()

SYSTEM_PROMPT = f"""당신은 경남 통영·거제·남해·고성 지역 양식 어업인을 위한 고수온·적조 대응 코치입니다.
아래 [공식 대응요령]에 근거해서만 답변하고, 근거가 없는 내용은 추측해서 말하지 마세요.
패류양식(굴·전복·멍게)에 대한 공식 어종별 세부 지침은 확인되지 않았으니, 해당 어종
질문에는 공통 조치사항 위주로 안내하고 "정확한 어종별 지침은 관할 수산사무소에
문의하시라"고 안내하세요.
답변은 실제 어업인이 바로 실행할 수 있도록 행동 지침 위주로, 3~5문장 이내로 간결하게
작성하세요.

{OFFICIAL_GUIDANCE}
"""


def get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. "
            ".env 파일에 Anthropic API 키를 넣어주세요."
        )
    return anthropic.Anthropic(api_key=api_key)


def generate_coaching_message(risk_result: dict, species: str, region: str) -> str:
    """위험도 산출 결과를 바탕으로 대응 코치 메시지를 생성한다."""
    client = get_client()

    user_context = (
        f"지역/관측소: {region}\n"
        f"양식 어종: {species}\n"
        f"위험도 등급: {risk_result['level']}\n"
        f"현재 수온: {risk_result.get('current_temp')}℃\n"
        f"72시간 후 예상 수온: {risk_result.get('predicted_temp_72h')}\n"
        f"판단 근거: {risk_result.get('reason')}\n\n"
        "위 상황에 맞는 대응 행동을 안내해줘."
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_context}],
    )

    return next((block.text for block in response.content if block.type == "text"), "")


if __name__ == "__main__":
    sample_risk = {
        "level": "관심",
        "current_temp": 26.3,
        "predicted_temp_72h": 27.1,
        "reason": "현재 수온 26.3℃로 26.0℃ 이상",
    }
    message = generate_coaching_message(sample_risk, species="우럭(조피볼락)", region="남해 강진")
    print(message)
