"""SQLite Database for MIRROR Emergency Digital Twin.

Stores persistent real-world entities:
- Hospitals (capacity, licensed beds, occupancy)
- Emergency Units (Ambulances Amb-01, Amb-02, and Fire Engine FE-01)
- Incidents & Dispatch Logs
"""

import sqlite3
import os
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "mirror.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initializes schema and seeds baseline emergency entities if table is empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Hospitals Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hospitals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            total_beds INTEGER NOT NULL,
            occupied_beds INTEGER NOT NULL,
            available_beds INTEGER NOT NULL,
            occupancy_percent REAL NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            surge_status TEXT NOT NULL
        )
    """)

    # 2. Emergency Units Table (Ambulances & Fire Engines)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emergency_units (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            callsign TEXT NOT NULL,
            status TEXT NOT NULL,
            speed_kmh INTEGER NOT NULL,
            target_destination TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL
        )
    """)

    # 3. Incidents Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT NOT NULL,
            sector_id TEXT NOT NULL,
            description TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL
        )
    """)

    conn.commit()

    # Seed data if empty
    cursor.execute("SELECT COUNT(*) FROM hospitals")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
            INSERT INTO hospitals (id, name, total_beds, occupied_beds, available_beds, occupancy_percent, latitude, longitude, surge_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ("H1", "Osmania General Hospital", 500, 440, 60, 88.0, 17.3785, 78.4735, "SURGE RISK"),
            ("H2", "Gandhi Hospital", 400, 216, 184, 54.0, 17.4240, 78.5030, "NOMINAL"),
            ("H3", "Nizam's Institute of Medical Sciences (NIMS)", 300, 123, 177, 41.0, 17.4223, 78.4526, "AVAILABLE"),
        ])

    cursor.execute("SELECT COUNT(*) FROM emergency_units")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
            INSERT INTO emergency_units (id, type, callsign, status, speed_kmh, target_destination, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ("Amb-01", "AMBULANCE", "ALS AMBULANCE", "TRANSIT", 42, "H1 Osmania", 17.3872, 78.4821),
            ("Amb-02", "AMBULANCE", "ALS AMBULANCE", "DELAYED", 0, "Held at Sec 07", 17.3745, 78.4910),
            ("FE-01", "FIRE", "HEAVY PUMPER", "DISPATCHED", 58, "Sec 04 Fire Hazard", 17.3890, 78.4760),
        ])

    cursor.execute("SELECT COUNT(*) FROM incidents")
    if cursor.fetchone()[0] == 0:
        cursor.executemany("""
            INSERT INTO incidents (id, title, type, severity, status, sector_id, description, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ("INC-04", "Structural Fire Hazard", "FIRE_HAZARD", "CRITICAL", "ACTIVE", "SEC-04", "Commercial blaze spreading toward primary arterial.", 17.3890, 78.4760),
            ("INC-07", "Water Inundation Surge", "FLOOD_SURGE", "HIGH", "ACTIVE", "SEC-07", "Sub-corridor submerged. Depth 3.5m, impassable for light units.", 17.3820, 78.4850),
            ("INC-09", "Junction Gridlock", "TRAFFIC_OBSTRUCTION", "HIGH", "ACTIVE", "SEC-09", "Multi-vehicle stall bottlenecking central corridor access.", 17.3980, 78.4890),
        ])

    conn.commit()
    conn.close()


def get_all_hospitals() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM hospitals")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_all_units() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emergency_units")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_all_incidents() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def dispatch_fire_engine(destination: str = "Sec 04 Fire Hazard", speed: int = 58) -> Dict[str, Any]:
    """Updates FE-01 state in database to DISPATCHED towards Sector 04."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE emergency_units
        SET status = 'DISPATCHED // EN ROUTE SEC 04',
            speed_kmh = ?,
            target_destination = ?,
            latitude = 17.3890,
            longitude = 78.4760
        WHERE id = 'FE-01'
    """, (speed, destination))
    conn.commit()
    cursor.execute("SELECT * FROM emergency_units WHERE id = 'FE-01'")
    updated = dict(cursor.fetchone())
    conn.close()
    return updated


# Automatically initialize on module import
init_database()
