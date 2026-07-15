"""웹 푸시 발송 — VAPID 키 생성 + 브라우저 구독으로 알림 보내기.

조기경보 앱인데 앱을 직접 열어봐야만 상태를 알 수 있으면 자기모순이다. 이 모듈은
그 문제를 풀기 위한 최소 구현이다: 로그인/계정 없이, 브라우저의 Push API 구독
정보(endpoint + 키)만으로 폰 알림창에 직접 경보를 띄운다.

캐시나 오프라인 지원은 하지 않는다(sw.js 주석 참고) — 여기서도 마찬가지로,
발송 실패는 조용히 넘기지 않고 호출측이 알 수 있게 예외를 올린다.

사용 순서:
  1) `python -m pipeline.push` 한 번 실행 → .env에 VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY 저장
  2) 프론트엔드가 /api/push/vapid-public-key로 공개키를 받아 구독 생성
  3) 프론트엔드가 /api/push/subscribe로 구독 정보를 백엔드에 저장
  4) pipeline/send_alerts.py를 크론(예: 매시 정각)으로 돌려서 위험도가 바뀐
     구독자에게만 푸시 발송
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pywebpush import webpush

sys.path.append(str(Path(__file__).resolve().parent.parent))

load_dotenv()


def get_vapid_public_key() -> str:
    key = os.environ.get("VAPID_PUBLIC_KEY")
    if not key:
        raise RuntimeError(
            "VAPID_PUBLIC_KEY가 설정되지 않았습니다. `python -m pipeline.push`로 키를 생성해 "
            ".env에 넣어주세요."
        )
    return key


def _vapid_claims() -> dict:
    contact = os.environ.get("VAPID_CONTACT_EMAIL", "mailto:example@example.com")
    return {"sub": contact}


def send_push(subscription_info: dict, title: str, body: str, url: str = "/") -> None:
    """구독 하나에 푸시 알림 하나를 보낸다. 만료/무효 구독이면 WebPushException을 올린다
    (호출측이 해당 구독을 DB에서 지우는 데 씀 — pipeline/send_alerts.py 참고)."""
    private_key = os.environ.get("VAPID_PRIVATE_KEY")
    if not private_key:
        raise RuntimeError("VAPID_PRIVATE_KEY가 설정되지 않았습니다.")

    webpush(
        subscription_info=subscription_info,
        data=json.dumps({"title": title, "body": body, "url": url}),
        vapid_private_key=private_key,
        vapid_claims=_vapid_claims(),
    )


if __name__ == "__main__":
    import base64

    from py_vapid import Vapid02
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

    v = Vapid02()
    v.generate_keys()

    raw_pub = v.public_key.public_bytes(encoding=Encoding.X962, format=PublicFormat.UncompressedPoint)
    pub_b64 = base64.urlsafe_b64encode(raw_pub).decode("utf-8").rstrip("=")

    raw_priv = v.private_key.private_numbers().private_value.to_bytes(32, "big")
    priv_b64 = base64.urlsafe_b64encode(raw_priv).decode("utf-8").rstrip("=")

    print("아래 두 줄을 .env에 붙여넣으세요 (이미 값이 있다면 새로 만들지 마세요 —")
    print("키가 바뀌면 기존에 구독한 브라우저가 전부 무효화됩니다):\n")
    print(f"VAPID_PUBLIC_KEY={pub_b64}")
    print(f"VAPID_PRIVATE_KEY={priv_b64}")
