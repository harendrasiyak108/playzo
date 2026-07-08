from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# --------- Models ---------
StationType = Literal["pc", "console", "table"]
StationStatus = Literal["available", "occupied", "maintenance"]


class Station(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: StationType
    hourly_rate: float
    status: StationStatus = "available"
    active_session_id: Optional[str] = None


class StationCreate(BaseModel):
    name: str
    type: StationType
    hourly_rate: float


class StationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[StationType] = None
    hourly_rate: Optional[float] = None
    status: Optional[StationStatus] = None


class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float
    category: str
    emoji: str = "🍔"


class MenuItemCreate(BaseModel):
    name: str
    price: float
    category: str
    emoji: str = "🍔"


class SessionItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int = 1
    emoji: str = "🍔"


class SessionStart(BaseModel):
    station_id: str
    customer_name: str
    customer_phone: str


class AddItemsRequest(BaseModel):
    items: List[SessionItem]


class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    station_id: str
    station_name: str
    station_type: str
    hourly_rate: float
    customer_name: str
    customer_phone: str
    start_time: str  # ISO string UTC
    end_time: Optional[str] = None
    items: List[SessionItem] = []
    status: Literal["active", "completed"] = "active"
    time_cost: float = 0.0
    items_cost: float = 0.0
    total: float = 0.0
    duration_minutes: float = 0.0
    payment_status: Literal["paid", "unpaid"] = "unpaid"
    payment_method: Optional[str] = None  # cash | upi | split
    payments: List[dict] = []
    paid_at: Optional[str] = None


class POSOrderCreate(BaseModel):
    items: List[SessionItem]
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None


class POSOrder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[SessionItem]
    total: float
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: str
    payment_status: Literal["paid", "unpaid"] = "unpaid"
    payment_method: Optional[str] = None
    payments: List[dict] = []
    paid_at: Optional[str] = None


class PinVerify(BaseModel):
    pin: str


class PinChange(BaseModel):
    current_pin: str
    new_pin: str


def _hash(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s)


# --------- Seed data ---------
DEFAULT_MENU = [
    {"name": "Lays Chips", "price": 20, "category": "Snacks", "emoji": "🍟"},
    {"name": "Popcorn", "price": 40, "category": "Snacks", "emoji": "🍿"},
    {"name": "Sandwich", "price": 80, "category": "Meals", "emoji": "🥪"},
    {"name": "Burger", "price": 120, "category": "Meals", "emoji": "🍔"},
    {"name": "Pizza Slice", "price": 100, "category": "Meals", "emoji": "🍕"},
    {"name": "French Fries", "price": 90, "category": "Snacks", "emoji": "🍟"},
    {"name": "Coca Cola", "price": 40, "category": "Drinks", "emoji": "🥤"},
    {"name": "Sprite", "price": 40, "category": "Drinks", "emoji": "🥤"},
    {"name": "Iced Tea", "price": 60, "category": "Drinks", "emoji": "🧋"},
    {"name": "Red Bull", "price": 130, "category": "Drinks", "emoji": "⚡"},
    {"name": "Coffee", "price": 50, "category": "Drinks", "emoji": "☕"},
    {"name": "Chocolate Bar", "price": 30, "category": "Snacks", "emoji": "🍫"},
]

DEFAULT_STATIONS = [
    {"name": "PC-01", "type": "pc", "hourly_rate": 80},
    {"name": "PC-02", "type": "pc", "hourly_rate": 80},
    {"name": "PC-03", "type": "pc", "hourly_rate": 80},
    {"name": "PC-04", "type": "pc", "hourly_rate": 100},
    {"name": "PS5-01", "type": "console", "hourly_rate": 150},
    {"name": "PS5-02", "type": "console", "hourly_rate": 150},
    {"name": "Xbox-01", "type": "console", "hourly_rate": 140},
    {"name": "Pool Table", "type": "table", "hourly_rate": 200},
]


@app.on_event("startup")
async def seed():
    if await db.menu_items.count_documents({}) == 0:
        docs = [MenuItem(**m).dict() for m in DEFAULT_MENU]
        await db.menu_items.insert_many(docs)
    if await db.stations.count_documents({}) == 0:
        docs = [Station(**s).dict() for s in DEFAULT_STATIONS]
        await db.stations.insert_many(docs)
    if await db.config.count_documents({"_id": "manager_pin"}) == 0:
        await db.config.insert_one({"_id": "manager_pin", "pin_hash": _hash("1234")})


# --------- Health ---------
@api_router.get("/")
async def root():
    return {"status": "ok", "app": "Playzo Gamezone Hub"}


# --------- Manager PIN ---------
@api_router.post("/manager/verify-pin")
async def verify_pin(payload: PinVerify):
    cfg = await db.config.find_one({"_id": "manager_pin"}, {"_id": 0})
    if not cfg:
        raise HTTPException(500, "PIN not initialized")
    ok = cfg["pin_hash"] == _hash(payload.pin)
    return {"ok": ok}


@api_router.post("/manager/change-pin")
async def change_pin(payload: PinChange):
    cfg = await db.config.find_one({"_id": "manager_pin"}, {"_id": 0})
    if not cfg or cfg["pin_hash"] != _hash(payload.current_pin):
        raise HTTPException(401, "Invalid current PIN")
    if not (payload.new_pin.isdigit() and 4 <= len(payload.new_pin) <= 8):
        raise HTTPException(400, "PIN must be 4-8 digits")
    await db.config.update_one({"_id": "manager_pin"}, {"$set": {"pin_hash": _hash(payload.new_pin)}})
    return {"ok": True}


# --------- Stations ---------
@api_router.get("/stations", response_model=List[Station])
async def list_stations():
    docs = await db.stations.find({}, {"_id": 0}).to_list(1000)
    return [Station(**d) for d in docs]


@api_router.post("/stations", response_model=Station)
async def create_station(payload: StationCreate):
    st = Station(**payload.dict())
    await db.stations.insert_one(st.dict())
    return st


@api_router.patch("/stations/{station_id}", response_model=Station)
async def update_station(station_id: str, payload: StationUpdate):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.stations.update_one({"id": station_id}, {"$set": updates})
    doc = await db.stations.find_one({"id": station_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Station not found")
    return Station(**doc)


@api_router.delete("/stations/{station_id}")
async def delete_station(station_id: str):
    doc = await db.stations.find_one({"id": station_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Station not found")
    if doc.get("status") == "occupied":
        raise HTTPException(400, "Cannot delete an occupied station")
    await db.stations.delete_one({"id": station_id})
    return {"ok": True}


# --------- Menu ---------
@api_router.get("/menu-items", response_model=List[MenuItem])
async def list_menu():
    docs = await db.menu_items.find({}, {"_id": 0}).to_list(1000)
    return [MenuItem(**d) for d in docs]


@api_router.post("/menu-items", response_model=MenuItem)
async def create_menu(payload: MenuItemCreate):
    item = MenuItem(**payload.dict())
    await db.menu_items.insert_one(item.dict())
    return item


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    emoji: Optional[str] = None


@api_router.patch("/menu-items/{item_id}", response_model=MenuItem)
async def update_menu(item_id: str, payload: MenuItemUpdate):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.menu_items.update_one({"id": item_id}, {"$set": updates})
    doc = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Menu item not found")
    return MenuItem(**doc)


@api_router.delete("/menu-items/{item_id}")
async def delete_menu(item_id: str):
    await db.menu_items.delete_one({"id": item_id})
    return {"ok": True}


# --------- Sessions ---------
def _compute_costs(session_doc: dict, end_dt: Optional[datetime] = None) -> dict:
    start_dt = _parse_iso(session_doc["start_time"])
    end_dt = end_dt or datetime.now(timezone.utc)
    duration_min = max(0.0, (end_dt - start_dt).total_seconds() / 60.0)
    hourly = float(session_doc["hourly_rate"])
    time_cost = round((duration_min / 60.0) * hourly, 2)
    items_cost = round(sum(i["price"] * i["quantity"] for i in session_doc.get("items", [])), 2)
    total = round(time_cost + items_cost, 2)
    return {
        "duration_minutes": round(duration_min, 2),
        "time_cost": time_cost,
        "items_cost": items_cost,
        "total": total,
    }


@api_router.post("/sessions/start", response_model=Session)
async def start_session(payload: SessionStart):
    station = await db.stations.find_one({"id": payload.station_id}, {"_id": 0})
    if not station:
        raise HTTPException(404, "Station not found")
    if station["status"] != "available":
        raise HTTPException(400, f"Station is {station['status']}")
    sess = Session(
        station_id=station["id"],
        station_name=station["name"],
        station_type=station["type"],
        hourly_rate=station["hourly_rate"],
        customer_name=payload.customer_name.strip(),
        customer_phone=payload.customer_phone.strip(),
        start_time=_now_iso(),
    )
    await db.sessions.insert_one(sess.dict())
    await db.stations.update_one(
        {"id": station["id"]},
        {"$set": {"status": "occupied", "active_session_id": sess.id}},
    )
    return sess


@api_router.get("/sessions/active", response_model=List[Session])
async def list_active_sessions():
    docs = await db.sessions.find({"status": "active"}, {"_id": 0}).to_list(1000)
    return [Session(**d) for d in docs]


@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Session not found")
    if doc["status"] == "active":
        live = _compute_costs(doc)
        return {**doc, **live, "live": True}
    return {**doc, "live": False}


@api_router.post("/sessions/{session_id}/add-items", response_model=Session)
async def add_items(session_id: str, payload: AddItemsRequest):
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Session not found")
    if doc["status"] != "active":
        raise HTTPException(400, "Session is not active")
    existing = doc.get("items", [])
    for new_item in payload.items:
        found = next((e for e in existing if e["menu_item_id"] == new_item.menu_item_id), None)
        if found:
            found["quantity"] += new_item.quantity
        else:
            existing.append(new_item.dict())
    await db.sessions.update_one({"id": session_id}, {"$set": {"items": existing}})
    doc["items"] = existing
    return Session(**doc)


@api_router.post("/sessions/{session_id}/remove-item")
async def remove_item(session_id: str, body: dict):
    menu_item_id = body.get("menu_item_id")
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Session not found")
    items = [i for i in doc.get("items", []) if i["menu_item_id"] != menu_item_id]
    await db.sessions.update_one({"id": session_id}, {"$set": {"items": items}})
    doc["items"] = items
    return Session(**doc)


@api_router.post("/sessions/{session_id}/end")
async def end_session(session_id: str):
    doc = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Session not found")
    if doc["status"] != "active":
        raise HTTPException(400, "Session already completed")
    end_dt = datetime.now(timezone.utc)
    costs = _compute_costs(doc, end_dt)
    updates = {
        **costs,
        "end_time": end_dt.isoformat(),
        "status": "completed",
    }
    await db.sessions.update_one({"id": session_id}, {"$set": updates})
    await db.stations.update_one(
        {"id": doc["station_id"]},
        {"$set": {"status": "available", "active_session_id": None}},
    )
    doc.update(updates)
    return doc


# --------- POS (walk-in) ---------
@api_router.post("/pos/orders", response_model=POSOrder)
async def create_pos(payload: POSOrderCreate):
    total = round(sum(i.price * i.quantity for i in payload.items), 2)
    order = POSOrder(
        items=payload.items,
        total=total,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        created_at=_now_iso(),
    )
    await db.pos_orders.insert_one(order.dict())
    return order


@api_router.get("/pos/orders", response_model=List[POSOrder])
async def list_pos():
    docs = await db.pos_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [POSOrder(**d) for d in docs]


# --------- Bills (unified history) ---------
@api_router.get("/bills")
async def list_bills(limit: int = 100, unpaid_only: bool = False):
    sess_query: dict = {"status": "completed"}
    pos_query: dict = {}
    if unpaid_only:
        sess_query["payment_status"] = "unpaid"
        pos_query["payment_status"] = "unpaid"
    sessions = await db.sessions.find(sess_query, {"_id": 0}).sort("end_time", -1).to_list(limit)
    pos = await db.pos_orders.find(pos_query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    bills = []
    for s in sessions:
        bills.append({
            "id": s["id"],
            "kind": "session",
            "title": f"{s['station_name']} · {s['customer_name']}",
            "customer_name": s["customer_name"],
            "customer_phone": s["customer_phone"],
            "time_cost": s.get("time_cost", 0),
            "items_cost": s.get("items_cost", 0),
            "total": s.get("total", 0),
            "duration_minutes": s.get("duration_minutes", 0),
            "items": s.get("items", []),
            "created_at": s.get("end_time"),
            "payment_status": s.get("payment_status", "unpaid"),
            "payment_method": s.get("payment_method"),
            "payments": s.get("payments", []),
            "paid_at": s.get("paid_at"),
        })
    for p in pos:
        bills.append({
            "id": p["id"],
            "kind": "pos",
            "title": f"POS Order · {p.get('customer_name') or 'Walk-in'}",
            "customer_name": p.get("customer_name"),
            "customer_phone": p.get("customer_phone"),
            "time_cost": 0,
            "items_cost": p["total"],
            "total": p["total"],
            "duration_minutes": 0,
            "items": p.get("items", []),
            "created_at": p.get("created_at"),
            "payment_status": p.get("payment_status", "unpaid"),
            "payment_method": p.get("payment_method"),
            "payments": p.get("payments", []),
            "paid_at": p.get("paid_at"),
        })
    bills.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return bills[:limit]


class PaymentEntry(BaseModel):
    name: Optional[str] = None
    method: Literal["cash", "upi"]
    amount: float


class PayRequest(BaseModel):
    method: Literal["cash", "upi", "split"]
    payments: Optional[List[PaymentEntry]] = None


@api_router.post("/bills/{kind}/{bill_id}/pay")
async def pay_bill(kind: str, bill_id: str, payload: PayRequest):
    if kind not in ("session", "pos"):
        raise HTTPException(400, "Invalid kind")
    collection = db.sessions if kind == "session" else db.pos_orders
    doc = await collection.find_one({"id": bill_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Bill not found")
    if kind == "session" and doc.get("status") != "completed":
        raise HTTPException(400, "Session must be ended before payment")
    total = float(doc["total"])
    payments_list: list = []
    if payload.method == "split":
        if not payload.payments or len(payload.payments) < 2:
            raise HTTPException(400, "Split requires at least 2 payers")
        s = round(sum(p.amount for p in payload.payments), 2)
        if abs(s - total) > 0.01:
            raise HTTPException(400, f"Split total {s} must equal bill total {total}")
        payments_list = [p.dict() for p in payload.payments]
    else:
        payments_list = [{"name": None, "method": payload.method, "amount": total}]
    updates = {
        "payment_status": "paid",
        "payment_method": payload.method,
        "payments": payments_list,
        "paid_at": _now_iso(),
    }
    await collection.update_one({"id": bill_id}, {"$set": updates})
    return {"ok": True, **updates}


# --------- Customer lookup (loyalty) ---------
@api_router.get("/customers/lookup")
async def customer_lookup(phone: str):
    phone = phone.strip()
    if len(phone) < 5:
        return {"visit_count": 0, "last_name": None, "last_visit_at": None, "total_spent": 0.0}
    sess = await db.sessions.find(
        {"customer_phone": phone, "status": "completed"}, {"_id": 0}
    ).sort("end_time", -1).to_list(500)
    pos = await db.pos_orders.find(
        {"customer_phone": phone}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    visits = len(sess) + len(pos)
    last_name = None
    last_visit_at = None
    total_spent = 0.0
    for s in sess:
        total_spent += float(s.get("total", 0))
        if not last_visit_at or s.get("end_time", "") > last_visit_at:
            last_visit_at = s.get("end_time")
            last_name = s.get("customer_name")
    for p in pos:
        total_spent += float(p.get("total", 0))
        if not last_visit_at or p.get("created_at", "") > last_visit_at:
            last_visit_at = p.get("created_at")
            if p.get("customer_name"):
                last_name = p.get("customer_name")
    return {
        "visit_count": visits,
        "last_name": last_name,
        "last_visit_at": last_visit_at,
        "total_spent": round(total_spent, 2),
    }


# --------- Analytics ---------
def _in_range(iso: Optional[str], start: datetime, end: datetime) -> bool:
    if not iso:
        return False
    dt = _parse_iso(iso)
    return start <= dt < end


# --------- Analytics ---------
def _in_range(iso: Optional[str], start: datetime, end: datetime) -> bool:
    if not iso:
        return False
    dt = _parse_iso(iso)
    return start <= dt < end


def _day_bounds(date: Optional[str]) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if date:
        y, m, d = map(int, date.split("-")[:3])
        start = datetime(y, m, d, tzinfo=timezone.utc)
    else:
        start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


@api_router.get("/reports/close-out")
async def close_out_report(date: Optional[str] = None):
    start, end = _day_bounds(date)
    sessions = await db.sessions.find({"status": "completed"}, {"_id": 0}).to_list(5000)
    pos = await db.pos_orders.find({}, {"_id": 0}).to_list(5000)

    cash_total = 0.0
    upi_total = 0.0
    unpaid_total = 0.0
    unpaid_bills: list = []
    time_revenue = 0.0
    fnb_revenue = 0.0
    session_count = 0
    pos_count = 0

    def add_payments(doc: dict, kind: str) -> None:
        nonlocal cash_total, upi_total, unpaid_total
        total = float(doc.get("total", 0))
        if doc.get("payment_status") == "paid":
            if doc.get("payment_method") == "split":
                for p in doc.get("payments", []):
                    m = p.get("method")
                    a = float(p.get("amount", 0))
                    if m == "cash":
                        cash_total += a
                    elif m == "upi":
                        upi_total += a
            elif doc.get("payment_method") == "cash":
                cash_total += total
            elif doc.get("payment_method") == "upi":
                upi_total += total
        else:
            unpaid_total += total
            unpaid_bills.append({
                "id": doc["id"],
                "kind": kind,
                "title": (
                    f"{doc.get('station_name', 'Station')} · {doc.get('customer_name', '')}"
                    if kind == "session" else
                    f"POS · {doc.get('customer_name') or 'Walk-in'}"
                ),
                "total": total,
                "customer_phone": doc.get("customer_phone"),
                "customer_name": doc.get("customer_name"),
                "created_at": doc.get("end_time") if kind == "session" else doc.get("created_at"),
            })

    for s in sessions:
        if _in_range(s.get("end_time"), start, end):
            time_revenue += float(s.get("time_cost", 0))
            fnb_revenue += float(s.get("items_cost", 0))
            session_count += 1
            add_payments(s, "session")

    for p in pos:
        if _in_range(p.get("created_at"), start, end):
            fnb_revenue += float(p.get("total", 0))
            pos_count += 1
            add_payments(p, "pos")

    collected = round(cash_total + upi_total, 2)
    total_billed = round(collected + unpaid_total, 2)
    unpaid_bills.sort(key=lambda x: x["created_at"] or "", reverse=True)

    return {
        "date": start.date().isoformat(),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "cash_total": round(cash_total, 2),
        "upi_total": round(upi_total, 2),
        "collected": collected,
        "unpaid_total": round(unpaid_total, 2),
        "total_billed": total_billed,
        "time_revenue": round(time_revenue, 2),
        "fnb_revenue": round(fnb_revenue, 2),
        "session_count": session_count,
        "pos_count": pos_count,
        "unpaid_bills": unpaid_bills,
    }


@api_router.get("/analytics/summary")
async def analytics_summary(range_type: str = "daily", date: Optional[str] = None):
    """range_type: 'daily' -> single day; 'monthly' -> whole month.
    date: YYYY-MM-DD for daily, YYYY-MM for monthly (defaults to today/this month, UTC)."""
    now = datetime.now(timezone.utc)
    if range_type == "monthly":
        if date:
            year, month = map(int, date.split("-")[:2])
        else:
            year, month = now.year, now.month
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    else:
        if date:
            y, m, d = map(int, date.split("-")[:3])
            start = datetime(y, m, d, tzinfo=timezone.utc)
        else:
            start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        end = start + timedelta(days=1)

    sessions = await db.sessions.find({"status": "completed"}, {"_id": 0}).to_list(5000)
    pos = await db.pos_orders.find({}, {"_id": 0}).to_list(5000)

    time_revenue = 0.0
    fnb_revenue = 0.0
    session_count = 0
    pos_count = 0
    total_minutes = 0.0

    # Buckets: for daily => hours 0-23; for monthly => days 1..end
    if range_type == "monthly":
        num_buckets = (end - start).days
        labels = [str(i + 1) for i in range(num_buckets)]

        def bucket_of(dt: datetime) -> int:
            return (dt - start).days
    else:
        num_buckets = 24
        labels = [f"{i:02d}" for i in range(24)]

        def bucket_of(dt: datetime) -> int:
            return dt.hour

    time_series = [0.0] * num_buckets
    fnb_series = [0.0] * num_buckets

    for s in sessions:
        if _in_range(s.get("end_time"), start, end):
            time_revenue += s.get("time_cost", 0)
            fnb_revenue += s.get("items_cost", 0)
            total_minutes += s.get("duration_minutes", 0)
            session_count += 1
            b = bucket_of(_parse_iso(s["end_time"]))
            if 0 <= b < num_buckets:
                time_series[b] += s.get("time_cost", 0)
                fnb_series[b] += s.get("items_cost", 0)

    for p in pos:
        if _in_range(p.get("created_at"), start, end):
            fnb_revenue += p.get("total", 0)
            pos_count += 1
            b = bucket_of(_parse_iso(p["created_at"]))
            if 0 <= b < num_buckets:
                fnb_series[b] += p.get("total", 0)

    total = round(time_revenue + fnb_revenue, 2)
    return {
        "range_type": range_type,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_revenue": total,
        "time_revenue": round(time_revenue, 2),
        "fnb_revenue": round(fnb_revenue, 2),
        "session_count": session_count,
        "pos_count": pos_count,
        "total_minutes": round(total_minutes, 2),
        "labels": labels,
        "time_series": [round(x, 2) for x in time_series],
        "fnb_series": [round(x, 2) for x in fnb_series],
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
