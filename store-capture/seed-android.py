"""Seed the demo gym name into the app's AsyncStorage on a rooted Android emulator.

Usage: python3 seed-android.py <adb serial>
The app must have been launched once so RKStorage exists. Only the branding key
is written; every other setting stays at the app default.
"""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time

PKG = "com.garrettscales.americana"
KEY = "americana.branding.v1"
VALUE = json.dumps({"gymName": "North Gym"})
serial = sys.argv[1] if len(sys.argv) > 1 else "emulator-5554"


def adb(*args, check=True):
    cmd = ["adb", "-s", serial, *args]
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


adb("root", check=False)
time.sleep(3)
adb("wait-for-device")
adb("shell", "am", "force-stop", PKG)
db_dir = f"/data/data/{PKG}/databases"
owner = adb("shell", "stat", "-c", "%U:%G", f"/data/data/{PKG}").stdout.strip()
print("owner", owner)
listing = adb("shell", "ls", db_dir, check=False).stdout
print("databases:", listing)
tmp = tempfile.mkdtemp()
local = os.path.join(tmp, "RKStorage")
have = "RKStorage" in listing.split()
if have:
    for suffix in ("", "-wal", "-shm", "-journal"):
        adb("pull", f"{db_dir}/RKStorage{suffix}", local + suffix, check=False)
con = sqlite3.connect(local)
con.execute("CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
con.execute("INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)", (KEY, VALUE))
con.commit()
try:
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.execute("PRAGMA journal_mode=DELETE")
except sqlite3.Error as exc:
    print("checkpoint", exc)
con.close()
print("rows", sqlite3.connect(local).execute("select key, value from catalystLocalStorage").fetchall())
adb("shell", "mkdir", "-p", db_dir)
for suffix in ("-wal", "-shm", "-journal"):
    adb("shell", "rm", "-f", f"{db_dir}/RKStorage{suffix}", check=False)
adb("push", local, f"{db_dir}/RKStorage")
adb("shell", "chown", "-R", owner, db_dir)
adb("shell", "chmod", "660", f"{db_dir}/RKStorage")
adb("shell", "restorecon", "-R", db_dir, check=False)
print("seeded", KEY, VALUE)
