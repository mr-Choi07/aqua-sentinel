"""수온 관측 이력을 누적 저장하는 SQLite 저장소.

위험도 산출 로직(risk.py)이 최근 N시간 추이를 계산하려면 시점별 관측값이
쌓여 있어야 하므로, collect_kosha.py 실행마다 이 모듈을 통해 SQLite에
이력을 적재한다. CSV 스냅샷은 그대로 유지하고, DB는 추이 계산 전용이다.
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "aqua_sentinel.db")


@contextmanager
def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS temperature_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sta_cde TEXT NOT NULL,
                sta_nam_kor TEXT,
                region TEXT,
                obs_lay TEXT,
                wtr_tmp REAL NOT NULL,
                observed_at TEXT NOT NULL,
                collected_at TEXT NOT NULL,
                UNIQUE(sta_cde, obs_lay, observed_at)
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_readings_station_time "
            "ON temperature_readings (sta_cde, obs_lay, observed_at)"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                sta_cde TEXT NOT NULL,
                species TEXT NOT NULL,
                last_level TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS farms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                species TEXT NOT NULL,
                stocking_info TEXT,
                sta_cde TEXT NOT NULL,
                distance_km REAL NOT NULL,
                far_match INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


def insert_readings(records: list[dict], region_map: dict[str, str]) -> int:
    """수온 관측 레코드를 저장한다. 이미 존재하는 (관측소, 층, 관측시각) 조합은 무시한다.

    NIFS 실시간 API는 센서 결측 시 wtr_tmp를 빈 문자열로 반환하는 경우가 있다
    (예: 정기 점검, 통신 장애). 그런 레코드까지 float() 변환하려다 예외가 나면
    /api/temperature 요청 전체가 500으로 죽어서 화면이 통째로 안 뜨므로,
    해당 레코드만 건너뛴다."""
    init_db()
    collected_at = datetime.now().isoformat(timespec="seconds")
    rows = []
    for r in records:
        try:
            wtr_tmp = float(r["wtr_tmp"])
        except (TypeError, ValueError):
            continue
        rows.append(
            (
                r["sta_cde"],
                r.get("sta_nam_kor"),
                region_map.get(r["sta_cde"]),
                r["obs_lay"],
                wtr_tmp,
                f"{r['obs_dat']} {r['obs_tim']}",
                collected_at,
            )
        )
    with get_connection() as conn:
        cursor = conn.executemany(
            """
            INSERT OR IGNORE INTO temperature_readings
                (sta_cde, sta_nam_kor, region, obs_lay, wtr_tmp, observed_at, collected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        return cursor.rowcount


def get_recent_readings(sta_cde: str, obs_lay: str = "1", hours: int = 72) -> list[tuple[str, float]]:
    """특정 관측소·수심층의 최근 hours 시간 이내 관측 이력을 (관측시각, 수온) 순으로 반환한다.

    observed_at은 API가 반환하는 관측지 현지시각(KST) 그대로 저장되므로, 비교 기준값도
    SQLite의 UTC 기반 datetime('now')가 아니라 파이썬 로컬 시각으로 직접 계산한다.
    """
    init_db()
    cutoff = (datetime.now() - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%M:%S")
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT observed_at, wtr_tmp FROM temperature_readings
            WHERE sta_cde = ? AND obs_lay = ?
              AND observed_at >= ?
            ORDER BY observed_at ASC
            """,
            (sta_cde, obs_lay, cutoff),
        )
        return cursor.fetchall()


def save_push_subscription(endpoint: str, p256dh: str, auth: str, sta_cde: str, species: str) -> None:
    """구독 정보를 저장한다. 같은 endpoint(=같은 브라우저 설치)로 다시 구독하면
    감시 대상(어장/어종)만 최신 값으로 덮어쓴다 — last_level은 유지해서, 이미
    경보 상태였던 걸 재구독했다고 알림이 또 나가지 않게 한다."""
    init_db()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO push_subscriptions (endpoint, p256dh, auth, sta_cde, species, last_level, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                sta_cde = excluded.sta_cde,
                species = excluded.species
            """,
            (endpoint, p256dh, auth, sta_cde, species, datetime.now().isoformat(timespec="seconds")),
        )


def delete_push_subscription(endpoint: str) -> None:
    """구독이 만료/무효화된 경우(발송 시 410/404 응답) 정리용."""
    init_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))


def get_all_push_subscriptions() -> list[dict]:
    init_db()
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute("SELECT * FROM push_subscriptions")
        return [dict(row) for row in cursor.fetchall()]


def update_push_subscription_level(endpoint: str, level: str) -> None:
    init_db()
    with get_connection() as conn:
        conn.execute("UPDATE push_subscriptions SET last_level = ? WHERE endpoint = ?", (level, endpoint))


def create_farm(
    name: str,
    lat: float,
    lon: float,
    species: str,
    stocking_info: str,
    sta_cde: str,
    distance_km: float,
    far_match: bool,
) -> int:
    """어장을 등록하고 새로 생성된 id를 반환한다. 로그인 계정이 없으므로,
    이 id를 프론트엔드가 localStorage에 기억해서 "내 어장"을 식별한다."""
    init_db()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO farms (name, lat, lon, species, stocking_info, sta_cde, distance_km, far_match, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                lat,
                lon,
                species,
                stocking_info,
                sta_cde,
                distance_km,
                1 if far_match else 0,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        return cursor.lastrowid


def get_farm(farm_id: int) -> dict | None:
    init_db()
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute("SELECT * FROM farms WHERE id = ?", (farm_id,))
        row = cursor.fetchone()
        if not row:
            return None
        farm = dict(row)
        # SQLite에는 진짜 boolean이 없어 0/1 정수로 저장했다 — JSON으로 나갈 때는
        # 프론트엔드가 {far_match && ...}로 조건 렌더링하므로 0이 그대로 나가면
        # falsy이지만 "0"이라는 문자열이 화면에 찍히는 React 특유의 함정에 걸린다.
        farm["far_match"] = bool(farm["far_match"])
        return farm
