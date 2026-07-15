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

이 모듈은 Claude에게 JSON 문자열만 반환하도록 요청하지만, 실제 파싱은 일부러
서버가 아니라 프론트엔드(frontend/src/api.ts)에서 한다 — 펜스 제거/파싱 실패 시
재시도/방어적 필터링까지 한곳(호출부)에서 관리하기 위해서다. 여기서는 원문
문자열을 그대로 반환한다.
"""

import os
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pipeline.risk import SPECIES_THRESHOLDS

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

# 구조화 출력 스키마를 프롬프트에 텍스트로 명시한다(Claude가 정확히 이 형태의
# JSON만 내도록). 필드 설명은 CoachAction/CoachResponse 문서와 동일하게 맞춘다.
RESPONSE_SCHEMA = """{
  "situation_summary": "string, 1문장, 현재 상황 요약",
  "actions": [
    {
      "title": "string, 10자 이내 (예: 먹이 주기 중단)",
      "detail": "string, 1문장, 왜/어떻게",
      "urgency": "now" | "today" | "monitor"
    }
  ],
  "contact_note": "string 또는 null, 관할 기관 문의가 필요한 경우만(기관명 포함)"
}"""

SYSTEM_PROMPT = f"""당신은 경남 통영·거제·남해·고성 지역 양식 어업인을 위한 고수온·적조 대응 코치입니다.
아래 [공식 대응요령]에 근거해서만 답변하고, 근거가 없는 내용은 추측해서 말하지 마세요.
패류양식(굴·전복·멍게)에 대한 공식 어종별 세부 지침은 확인되지 않았으니, 해당 어종
질문에는 공통 조치사항 위주로 안내하고, 필요하다면 contact_note에 관할 수산사무소
문의를 안내하세요.

다음 JSON 스키마로만 응답하세요. 마크다운, 인사말, 부연 설명 금지 — 오직 JSON만
출력합니다.
{RESPONSE_SCHEMA}

반드시 지킬 규칙:
- 제공된 관측 데이터에 없는 수치나 예측(향후 수온 전망, 하강 시점 등)을 절대
  만들어내지 마세요. 예측 정보가 없으면 언급하지 않습니다.
- 외부 웹사이트나 다른 앱에서 확인하라는 안내를 하지 마세요. 수온 확인은 이 앱이
  이미 실시간으로 보여주고 있습니다. [공식 대응요령]에 "국립수산과학원 홈페이지에서
  실시간 수온 확인"이 있어도, 그 항목을 행동으로 만들지 마세요(예: "실시간 수온
  확인", "홈페이지에서 확인" 같은 행동 금지) — 사용자는 이미 이 화면에서 수온을
  보고 있습니다.
- 각 행동은 고령 사용자가 이해할 쉬운 말로 쓰세요. 한 행동당 제목은 10자 이내,
  설명은 1문장으로 쓰고, 전문용어(예: 성층화)를 쓸 경우 괄호로 풀어서 설명하세요.
- 행동은 중요한 순서대로 최대 4개까지만 제시하세요.
- urgency는 위험등급과 어긋나면 안 됩니다: 위험등급이 "정상"이면 모든 행동의
  urgency를 "monitor"로만 쓰세요(지금 당장 급한 조치는 없는 상태이므로 "now"/
  "today"를 쓰지 마세요). "관심"이면 "today"/"monitor"만 쓰고 "now"는 쓰지
  마세요. "주의"·"경보"일 때만 "now"를 쓸 수 있습니다.
- contact_note에 전화번호·팩스번호 등 구체적 연락처를 지어내지 마세요. 실제
  번호를 알 수 없으니 기관명만 안내하세요(예: "남해군청 수산과에 문의하세요").

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


def _trend_description(risk_result: dict) -> str:
    """예측치(predicted_temp_72h)는 일부러 전달하지 않는다 — 그 자체가 우리 쪽
    선형회귀 추정값이라, 코치가 이를 근거로 새로운 향후 전망을 서술하게 되는
    빌미를 주지 않기 위해서다. 대신 이미 일어난 관측 추세만 전달한다."""
    rising_days = risk_result.get("rising_streak_days") or 0
    if rising_days >= 2:
        return f"{rising_days}일째 상승 중"
    delta = risk_result.get("day_over_day_delta")
    if delta is not None:
        direction = "상승" if delta >= 0 else "하강"
        return f"전일 대비 {delta:+.1f}℃ ({direction})"
    return "추세 데이터 없음"


def generate_coaching_message(risk_result: dict, species: str, region: str, redtide_nearby: bool = False) -> str:
    """위험도 산출 결과를 바탕으로 대응 코치 응답(JSON 문자열)을 생성한다.

    반환값은 파싱되지 않은 원문 텍스트다 — 파싱/검증/재시도는 호출부(프론트엔드
    api.ts)의 책임이다.
    """
    client = get_client()
    thresholds = SPECIES_THRESHOLDS.get(species, SPECIES_THRESHOLDS["일반(기본)"])

    user_context = (
        f"관측소명: {region}\n"
        f"어종: {species}\n"
        f"현재 수온: {risk_result.get('current_temp')}℃\n"
        f"위험등급: {risk_result['level']}\n"
        f"등급 판정 사유: {risk_result.get('reason')}\n"
        f"어종별 관심 임계수온: {thresholds['warning']}℃, 주의(경보 트리거) 임계수온: {thresholds['alert']}℃\n"
        f"최근 추세: {_trend_description(risk_result)}\n"
        f"적조속보 해당 여부: {'있음' if redtide_nearby else '없음'}\n\n"
        "위 상황에 맞는 대응 행동을 JSON 스키마 그대로 안내해줘."
    )

    response = client.messages.create(
        model=MODEL,
        # 구조화 JSON 출력은 스키마 오버헤드가 있어 512로는 잘릴 수 있다
        # (pipeline/damage_report.py에서 같은 문제를 겪은 적 있음) — 여유를 둔다.
        max_tokens=1024,
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
        "reason": "현재 수온 26.3℃로 26.0℃ 이상",
        "day_over_day_delta": 0.8,
        "rising_streak_days": 2,
    }
    message = generate_coaching_message(
        sample_risk, species="우럭(조피볼락)", region="남해 강진", redtide_nearby=False
    )
    print(message)
