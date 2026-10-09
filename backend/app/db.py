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

    # 3. Incidents Table (Dynamic Localized Hazard Zones)
    cursor.execute("PRAGMA table_info(incidents)")
    cols = [row[1] for row in cursor.fetchall()]
    if cols and ("radius_meters" not in cols or "incident_type" not in cols):
        cursor.execute("DROP TABLE IF EXISTS incidents")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            incident_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            radius_meters INTEGER NOT NULL DEFAULT 250,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            description TEXT,
            created_at TEXT
        )
    """)

    # 4. Users Table (Multi-User Roles & Live Location)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            is_online INTEGER NOT NULL DEFAULT 1
        )
    """)

    conn.commit()

    # Seed users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        from app.auth import hash_password
        default_pw = hash_password("password123")
        cursor.executemany("""
            INSERT INTO users (id, name, email, password_hash, role, lat, lng, is_online)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            ("usr-amb-01", "Ambulance Unit 01", "ambulance@mirror.emergency", default_pw, "AMBULANCE", 17.3872, 78.4821, 1),
            ("usr-fe-01", "Fire Engine FE-01", "fire@mirror.emergency", default_pw, "FIRE_ENGINE", 17.3890, 78.4760, 1),
            ("usr-police-01", "Traffic Patrol 04", "police@mirror.emergency", default_pw, "TRAFFIC_POLICE", 17.3980, 78.4890, 1),
            ("usr-public-01", "Citizen Public", "citizen@mirror.emergency", default_pw, "PUBLIC", 17.3820, 78.4850, 1),
        ])
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


def get_all_incidents(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns dynamic incidents, optionally filtered by status."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM incidents WHERE status = ? ORDER BY rowid DESC", (status,))
    else:
        cursor.execute("SELECT * FROM incidents ORDER BY rowid DESC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_incident_by_id(incident_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def create_incident(
    incident_id: str,
    title: str,
    incident_type: str,
    severity: str,
    lat: float,
    lng: float,
    radius_meters: int = 250,
    status: str = "ACTIVE",
    description: str = "",
    created_at: Optional[str] = None,
) -> Dict[str, Any]:
    import datetime
    if not created_at:
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO incidents (id, title, incident_type, severity, lat, lng, radius_meters, status, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (incident_id, title, incident_type, severity, lat, lng, radius_meters, status, description, created_at))
    conn.commit()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    rec = dict(cursor.fetchone())
    conn.close()
    return rec


def update_incident_status(incident_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE incidents SET status = ? WHERE id = ?", (new_status, incident_id))
    conn.commit()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_incident(incident_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted


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


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(
    user_id: str,
    name: str,
    email: str,
    password_hash: str,
    role: str,
    lat: float = 17.3850,
    lng: float = 78.4867,
    is_online: bool = True,
) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (id, name, email, password_hash, role, lat, lng, is_online)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, name, email.strip().lower(), password_hash, role, lat, lng, 1 if is_online else 0))
    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict(cursor.fetchone())
    conn.close()
    return user


def get_active_users() -> List[Dict[str, Any]]:
    """Returns all online responders and users with their coordinates."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, email, role, lat, lng, is_online
        FROM users
        WHERE is_online = 1
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    for r in rows:
        r["is_online"] = bool(r["is_online"])
    return rows


def update_user_location(user_id: str, lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """Updates user's GPS coordinates."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users
        SET lat = ?, lng = ?, is_online = 1
        WHERE id = ?
    """, (lat, lng, user_id))
    conn.commit()
    cursor.execute("SELECT id, name, email, role, lat, lng, is_online FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["is_online"] = bool(d["is_online"])
    return d


# Automatically initialize on module import
init_database()
