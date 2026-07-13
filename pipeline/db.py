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


def insert_readings(records: list[dict], region_map: dict[str, str]) -> int:
    """수온 관측 레코드를 저장한다. 이미 존재하는 (관측소, 층, 관측시각) 조합은 무시한다."""
    init_db()
    collected_at = datetime.now().isoformat(timespec="seconds")
    rows = [
        (
            r["sta_cde"],
            r.get("sta_nam_kor"),
            region_map.get(r["sta_cde"]),
            r["obs_lay"],
            float(r["wtr_tmp"]),
            f"{r['obs_dat']} {r['obs_tim']}",
            collected_at,
        )
        for r in records
    ]
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
