"""Playzo Gamezone Hub backend tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://gamezone-ops.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Seed / Health ----------
def test_health(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_seed_stations(s):
    r = s.get(f"{API}/stations")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 8
    types = [d["type"] for d in data]
    assert types.count("pc") >= 4
    assert types.count("console") >= 3
    assert types.count("table") >= 1


def test_seed_menu(s):
    r = s.get(f"{API}/menu-items")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 12
    cats = {d["category"] for d in data}
    assert {"Snacks", "Meals", "Drinks"}.issubset(cats)


# ---------- Manager PIN ----------
def test_verify_pin_default(s):
    r = s.post(f"{API}/manager/verify-pin", json={"pin": "1234"})
    assert r.status_code == 200 and r.json()["ok"] is True
    r2 = s.post(f"{API}/manager/verify-pin", json={"pin": "0000"})
    assert r2.status_code == 200 and r2.json()["ok"] is False


def test_change_pin_roundtrip(s):
    r = s.post(f"{API}/manager/change-pin", json={"current_pin": "1234", "new_pin": "5678"})
    assert r.status_code == 200 and r.json()["ok"] is True
    # new works
    assert s.post(f"{API}/manager/verify-pin", json={"pin": "5678"}).json()["ok"] is True
    assert s.post(f"{API}/manager/verify-pin", json={"pin": "1234"}).json()["ok"] is False
    # change back
    r2 = s.post(f"{API}/manager/change-pin", json={"current_pin": "5678", "new_pin": "1234"})
    assert r2.status_code == 200
    assert s.post(f"{API}/manager/verify-pin", json={"pin": "1234"}).json()["ok"] is True
    # invalid current
    bad = s.post(f"{API}/manager/change-pin", json={"current_pin": "0000", "new_pin": "1111"})
    assert bad.status_code == 401


# ---------- Session Full Flow ----------
@pytest.fixture(scope="module")
def created_ids():
    return {"station_id": None, "session_id": None, "pos_id": None}


def test_full_session_flow(s, created_ids):
    stations = s.get(f"{API}/stations").json()
    avail = next((x for x in stations if x["status"] == "available"), None)
    assert avail is not None
    created_ids["station_id"] = avail["id"]

    # Start
    r = s.post(f"{API}/sessions/start", json={
        "station_id": avail["id"], "customer_name": "TEST_John", "customer_phone": "9999900000"
    })
    assert r.status_code == 200
    sess = r.json()
    created_ids["session_id"] = sess["id"]
    assert sess["status"] == "active"

    # Station is occupied
    st = next(x for x in s.get(f"{API}/stations").json() if x["id"] == avail["id"])
    assert st["status"] == "occupied"
    assert st["active_session_id"] == sess["id"]

    # Cannot start on occupied
    r2 = s.post(f"{API}/sessions/start", json={
        "station_id": avail["id"], "customer_name": "X", "customer_phone": "1"
    })
    assert r2.status_code == 400

    # GET live=true with dynamic time_cost
    time.sleep(2)
    live = s.get(f"{API}/sessions/{sess['id']}").json()
    assert live["live"] is True
    assert "time_cost" in live

    # Add items
    menu = s.get(f"{API}/menu-items").json()
    m1, m2 = menu[0], menu[1]
    items = [
        {"menu_item_id": m1["id"], "name": m1["name"], "price": m1["price"], "quantity": 2, "emoji": m1["emoji"]},
        {"menu_item_id": m2["id"], "name": m2["name"], "price": m2["price"], "quantity": 1, "emoji": m2["emoji"]},
    ]
    r3 = s.post(f"{API}/sessions/{sess['id']}/add-items", json={"items": items})
    assert r3.status_code == 200
    assert len(r3.json()["items"]) == 2

    # End session
    time.sleep(2)
    r4 = s.post(f"{API}/sessions/{sess['id']}/end")
    assert r4.status_code == 200
    ended = r4.json()
    assert ended["status"] == "completed"
    expected_items = m1["price"] * 2 + m2["price"]
    assert abs(ended["items_cost"] - expected_items) < 0.01
    assert ended["total"] == round(ended["time_cost"] + ended["items_cost"], 2)

    # Station released
    st2 = next(x for x in s.get(f"{API}/stations").json() if x["id"] == avail["id"])
    assert st2["status"] == "available"
    assert st2.get("active_session_id") in (None, "")

    # Cannot end twice
    r5 = s.post(f"{API}/sessions/{sess['id']}/end")
    assert r5.status_code == 400


# ---------- POS ----------
def test_pos_order(s, created_ids):
    menu = s.get(f"{API}/menu-items").json()
    m = menu[2]
    items = [{"menu_item_id": m["id"], "name": m["name"], "price": m["price"], "quantity": 3, "emoji": m["emoji"]}]
    r = s.post(f"{API}/pos/orders", json={"items": items, "customer_name": "TEST_Walkin"})
    assert r.status_code == 200
    order = r.json()
    created_ids["pos_id"] = order["id"]
    assert abs(order["total"] - m["price"] * 3) < 0.01


# ---------- Bills ----------
def test_bills_unified(s, created_ids):
    r = s.get(f"{API}/bills")
    assert r.status_code == 200
    bills = r.json()
    assert isinstance(bills, list) and len(bills) >= 2
    kinds = {b["kind"] for b in bills}
    assert {"session", "pos"}.issubset(kinds)
    # Sorted DESC by created_at
    dates = [b["created_at"] for b in bills if b["created_at"]]
    assert dates == sorted(dates, reverse=True)
    assert any(b["id"] == created_ids["session_id"] for b in bills)
    assert any(b["id"] == created_ids["pos_id"] for b in bills)


# ---------- Analytics ----------
def test_analytics_daily(s):
    r = s.get(f"{API}/analytics/summary", params={"range_type": "daily"})
    assert r.status_code == 200
    a = r.json()
    assert len(a["labels"]) == 24
    assert len(a["time_series"]) == 24
    assert len(a["fnb_series"]) == 24
    assert a["session_count"] >= 1
    assert a["pos_count"] >= 1
    assert a["total_revenue"] >= 0


def test_analytics_monthly(s):
    r = s.get(f"{API}/analytics/summary", params={"range_type": "monthly"})
    assert r.status_code == 200
    a = r.json()
    assert 28 <= len(a["labels"]) <= 31
    assert len(a["time_series"]) == len(a["labels"])


# ---------- Station CRUD ----------
def test_station_lifecycle(s):
    # create
    r = s.post(f"{API}/stations", json={"name": "TEST_PC", "type": "pc", "hourly_rate": 90})
    assert r.status_code == 200
    sid = r.json()["id"]
    # patch
    r2 = s.patch(f"{API}/stations/{sid}", json={"hourly_rate": 110, "name": "TEST_PC_v2"})
    assert r2.status_code == 200
    assert r2.json()["hourly_rate"] == 110
    assert r2.json()["name"] == "TEST_PC_v2"
    # GET verifies persistence
    st = next(x for x in s.get(f"{API}/stations").json() if x["id"] == sid)
    assert st["hourly_rate"] == 110
    # delete
    r3 = s.delete(f"{API}/stations/{sid}")
    assert r3.status_code == 200
    # verify gone
    assert not any(x["id"] == sid for x in s.get(f"{API}/stations").json())


def test_delete_occupied_station_400(s):
    stations = s.get(f"{API}/stations").json()
    avail = next(x for x in stations if x["status"] == "available")
    ss = s.post(f"{API}/sessions/start", json={
        "station_id": avail["id"], "customer_name": "TEST_Occ", "customer_phone": "1"
    }).json()
    try:
        r = s.delete(f"{API}/stations/{avail['id']}")
        assert r.status_code == 400
    finally:
        s.post(f"{API}/sessions/{ss['id']}/end")
