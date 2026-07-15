"""구독자별 위험도를 확인해, 등급이 바뀐 경우에만 웹 푸시를 보낸다.

크론(예: Windows 작업 스케줄러 또는 cron, 매시 정각)으로 이 스크립트를 돌리는 걸
전제로 만들었다 — 서버에 항상 떠 있는 백그라운드 프로세스가 아니라, 실행할
때마다 한 번 검사하고 끝나는 방식이다.

같은 등급을 매번 다시 보내면 알림 피로로 무시당하기 쉬우므로, 구독 저장 시점의
last_level과 지금 계산한 level이 다를 때만 보낸다. 등급이 좋아지는 방향
(예: 경보 -> 정상)으로 바뀔 때도 안내한다 — "이제 괜찮아졌다"는 것도 조업 재개
판단에 필요한 정보라서 조용히 넘기지 않는다.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from pywebpush import WebPushException

from pipeline.collect_kosha import TARGET_STATIONS
from pipeline.db import delete_push_subscription, get_all_push_subscriptions, update_push_subscription_level
from pipeline.push import send_push
from pipeline.risk import classify_station_risk

# 알림을 보낼 만큼 긴급하다고 볼 등급. "관심"은 아직 예상 단계라 매번 알리면
# 피로도가 높을 수 있어 뺐다 — 실제 조치가 필요해지는 "주의" 이상부터 보낸다.
NOTIFY_LEVELS = {"주의", "경보"}


def _message_for(region: str, level: str, current_temp: float | None, reason: str) -> tuple[str, str]:
    temp_str = f"{current_temp:.1f}°C" if current_temp is not None else "확인 불가"
    if level == "경보":
        return (f"[경보] {region} 고수온 위험", f"현재 수온 {temp_str}. {reason}")
    if level == "주의":
        return (f"[주의] {region} 수온 상승", f"현재 수온 {temp_str}. {reason}")
    return (f"{region} 상황 안정", f"현재 수온 {temp_str}로 정상 범위로 돌아왔어요.")


def run() -> None:
    subscriptions = get_all_push_subscriptions()
    if not subscriptions:
        print("구독자가 없습니다.")
        return

    sent, skipped, expired = 0, 0, 0
    for sub in subscriptions:
        sta_cde = sub["sta_cde"]
        species = sub["species"]
        region = TARGET_STATIONS.get(sta_cde, sta_cde)

        result = classify_station_risk(sta_cde, species=species)
        level = result["level"]

        # 등급이 안 바뀌었으면 조용히 넘어간다.
        if level == sub["last_level"]:
            skipped += 1
            continue

        # 데이터 부족 상태로의 전환은 알릴 만한 사건이 아니다(관측소 일시 장애일 수 있음).
        should_notify = level in NOTIFY_LEVELS or (
            sub["last_level"] in NOTIFY_LEVELS and level not in (None, "데이터 부족")
        )

        if should_notify:
            title, body = _message_for(region, level, result.get("current_temp"), result.get("reason", ""))
            subscription_info = {
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            }
            try:
                send_push(subscription_info, title, body, url="/")
                sent += 1
            except WebPushException as e:
                status = getattr(e.response, "status_code", None)
                if status in (404, 410):  # 구독 만료/취소됨
                    delete_push_subscription(sub["endpoint"])
                    expired += 1
                    continue
                print(f"발송 실패({sta_cde}): {e}")
                continue

        update_push_subscription_level(sub["endpoint"], level)

    print(f"발송 {sent}건, 등급 유지로 스킵 {skipped}건, 만료 정리 {expired}건")


if __name__ == "__main__":
    run()
