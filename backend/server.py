from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import json
import re
import uuid
import logging
import tempfile
import calendar
from pathlib import Path
from typing import Annotated, Any, List, Optional, Literal
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from emergentintegrations.llm.openai import OpenAISpeechToText
from typesafe_sdk import Choice, Score, TypeSafeAPIError, TypeSafeError
from jev import get_jev_client, jev_error_code

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
LLM_KEY = os.environ['EMERGENT_LLM_KEY']
PK_TZ = ZoneInfo("Asia/Karachi")

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger("gharkhata")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

CATEGORIES = ["grocery", "milk_veg", "bills", "transport", "health", "education", "guests", "clothes", "other"]
METHODS = ["cash", "jazzcash", "easypaisa", "bank"]
CATEGORY_CRITERIA = {
    "grocery": "Kiryana / grocery staples: aata flour, cheeni sugar, ghee, oil, rice, daal, masalay, soap, household supplies",
    "milk_veg": "Daily fresh food: doodh milk, dahi, sabzi vegetables, phal fruit, gosht meat, chicken, anday eggs, bread, roti",
    "bills": "Utility bills and recharge: bijli electricity, gas, internet, mobile load/package, paani water, cable",
    "transport": "Travel and vehicle: petrol, rickshaw, bus, careem, kiraya fare, bike repair, parking",
    "health": "Health: dawai medicine, doctor, hospital, lab test, chemist",
    "education": "Children's education: school/college fee, tuition, books, copies, uniform, stationery",
    "guests": "Hospitality and social: mehman guests, dawat, mithai, gifts, shaadi, eidi, sadqa",
    "clothes": "Clothing: kapray, joote shoes, darzi tailor, cloth",
    "other": "Anything else that does not fit the categories above",
}
SPEND_LEVELS = ["normal", "slightly_high", "unusual"]


async def jev_ask(state: dict, questions: dict):
    """Returns Jev response or None on any failure (callers fall back gracefully)."""
    try:
        return await get_jev_client().system_one(model="jev-latest", state=state, questions=questions)
    except TypeSafeAPIError as exc:
        logger.warning("jev api error %s %s", exc.status, jev_error_code(exc))
    except TypeSafeError as exc:
        logger.warning("jev unavailable %s", exc)
    return None


# ---------- Mongo helpers ----------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True, exclude={"id"})
        return d

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)


def now_pk() -> datetime:
    return datetime.now(timezone.utc).astimezone(PK_TZ)


def today_str() -> str:
    return now_pk().strftime("%Y-%m-%d")


def month_str() -> str:
    return now_pk().strftime("%Y-%m")


def oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(404, "نہیں ملا")


# ---------- Models ----------
class Settings(BaseDocument):
    monthly_budget: float = 50000
    members: List[str] = Field(default_factory=lambda: ["امی", "ابو"])


class SettingsIn(BaseModel):
    monthly_budget: float = Field(ge=0)
    members: List[str]


class Expense(BaseDocument):
    amount: float
    category: str = "other"
    note: str = ""
    payment_method: str = "cash"
    member: str = ""
    date: str
    created_at: str
    spend_level: Optional[str] = None


class ExpenseIn(BaseModel):
    amount: float = Field(gt=0)
    category: Literal[tuple(CATEGORIES)] = "other"
    note: str = ""
    payment_method: Literal[tuple(METHODS)] = "cash"
    member: str = ""
    date: Optional[str] = None


class UdhaarEntry(BaseDocument):
    person: str
    amount: float
    kind: Literal["lena", "dena"]
    note: str = ""
    date: str
    settled: bool = False


class UdhaarIn(BaseModel):
    person: str = Field(min_length=1)
    amount: float = Field(gt=0)
    kind: Literal["lena", "dena"]
    note: str = ""


class SettleIn(BaseModel):
    person: str


class Bill(BaseDocument):
    name: str
    amount: float
    due_day: int
    kind: str = "other"
    paid_months: List[str] = Field(default_factory=list)


class BillIn(BaseModel):
    name: str = Field(min_length=1)
    amount: float = Field(ge=0)
    due_day: int = Field(ge=1, le=31)
    kind: Literal["electricity", "gas", "internet", "mobile", "water", "other"] = "other"


class ParseIn(BaseModel):
    text: str = Field(min_length=1)
    source: Literal["text", "voice", "sms"] = "text"


class CategorizeIn(BaseModel):
    note: str = Field(min_length=1, max_length=300)


# ---------- Settings ----------
async def get_settings_doc() -> Settings:
    doc = await db.settings.find_one({})
    if not doc:
        s = Settings()
        res = await db.settings.insert_one(s.to_mongo())
        doc = await db.settings.find_one({"_id": res.inserted_id})
    return Settings.from_mongo(doc)


@api.get("/")
async def root():
    return {"message": "گھر کھاتہ"}


@api.get("/settings")
async def read_settings():
    return (await get_settings_doc()).model_dump()


@api.put("/settings")
async def update_settings(body: SettingsIn):
    s = await get_settings_doc()
    members = [m.strip() for m in body.members if m.strip()]
    await db.settings.update_one({"_id": ObjectId(s.id)}, {"$set": {"monthly_budget": body.monthly_budget, "members": members}})
    return (await get_settings_doc()).model_dump()


# ---------- Expenses ----------
@api.get("/expenses")
async def list_expenses(month: Optional[str] = None, limit: int = 200):
    q = {"date": {"$regex": f"^{month}"}} if month else {}
    docs = await db.expenses.find(q).sort([("date", -1), ("created_at", -1)]).to_list(limit)
    return [Expense.from_mongo(d).model_dump() for d in docs]


async def insert_expense(body: ExpenseIn, spend_level: Optional[str] = None) -> dict:
    e = Expense(**body.model_dump(exclude={"date"}), date=body.date or today_str(),
                created_at=datetime.now(timezone.utc).isoformat(), spend_level=spend_level)
    res = await db.expenses.insert_one(e.to_mongo())
    e.id = str(res.inserted_id)
    return e.model_dump()


async def spend_check(body: ExpenseIn) -> Optional[str]:
    s = await summary()
    state = {"new_expense_pkr": body.amount, "category": body.category, "note": body.note,
             "already_spent_today_pkr": s["today_spent"], "comfortable_daily_limit_pkr": s["daily_limit"],
             "monthly_budget_pkr": s["monthly_budget"], "spent_this_month_pkr": s["month_spent"]}
    r = await jev_ask(state, {"level": Score(
        instructions="For a Pakistani household, how unusual is this new expense compared with the comfortable daily limit, "
                     "the budget and what the category normally costs? Planned bills and school fees are normal.",
        criteria=SPEND_LEVELS)})
    if not r:
        return None
    probs = r.scores["level"].probabilities
    return SPEND_LEVELS[max(probs, key=probs.get)]


@api.post("/expenses")
async def create_expense(body: ExpenseIn):
    return await insert_expense(body, await spend_check(body))


@api.post("/categorize")
async def categorize(body: CategorizeIn):
    r = await jev_ask({"expense_note": body.note}, {"category": Choice(
        instructions="Which household expense category does this Urdu / Roman Urdu / English note belong to?",
        criteria=CATEGORY_CRITERIA)})
    if not r:
        return {"category": None, "confidence": 0, "ai_classified": False}
    c = r.choices["category"]
    return {"category": c.choice, "confidence": c.confidence, "ai_classified": True}


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str):
    r = await db.expenses.delete_one({"_id": oid(eid)})
    if not r.deleted_count:
        raise HTTPException(404, "نہیں ملا")
    return {"ok": True}


# ---------- Smart helper (parse text / SMS) ----------
PARSE_SYSTEM = f"""You read short Urdu, Roman Urdu or English sentences, or Pakistani bank / JazzCash / Easypaisa SMS, and extract ONE household expense.
Return ONLY a JSON object, no markdown:
{{"amount": number (PKR, 0 if not found), "category": one of {CATEGORIES}, "note": short simple Urdu (Nastaliq script) description, max 6 words,
"payment_method": one of {METHODS} (cash if spoken and unclear; jazzcash/easypaisa/bank if SMS mentions it), "member": name of family member who spent if mentioned else ""}}
Category hints: grocery=سودا سلف, آٹا, چینی, گھی, کریانہ; milk_veg=دودھ, سبزی, پھل, گوشت, انڈے; bills=بجلی, گیس, انٹرنیٹ, موبائل لوڈ, پانی;
transport=پیٹرول, رکشہ, کرایہ, بس; health=دوا, ڈاکٹر; education=اسکول, فیس, کتابیں, ٹیوشن; guests=مہمان, دعوت, تحفہ; clothes=کپڑے, جوتے, درزی.
Understand Urdu number words (سو=100, ہزار=1000, ڈیڑھ سو=150, ڈھائی سو=250, پانچ سو=500). Ignore account balances in SMS; use the transaction amount."""


async def parse_text(text: str) -> dict:
    s = await get_settings_doc()
    system = PARSE_SYSTEM + f"\nKnown family members (use the exact spelling if one is mentioned): {s.members}"
    chat = LlmChat(api_key=LLM_KEY, session_id=f"parse-{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-5.2")
    out = ""
    async for ev in chat.stream_message(UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        raise HTTPException(422, "بات سمجھ نہیں آئی، دوبارہ کوشش کریں")
    data: dict[str, Any] = json.loads(m.group(0))
    cat = data.get("category") if data.get("category") in CATEGORIES else "other"
    meth = data.get("payment_method") if data.get("payment_method") in METHODS else "cash"
    try:
        amount = float(data.get("amount") or 0)
    except (TypeError, ValueError):
        amount = 0
    return {"amount": amount, "category": cat, "note": str(data.get("note") or ""),
            "payment_method": meth, "member": str(data.get("member") or "")}


SMS_KINDS = {
    "spend": "Money went OUT: a purchase, payment, bill payment, transfer sent, cash withdrawal or mobile load",
    "received": "Money came IN: amount received, salary credited, refund, transfer received",
    "otp": "A one-time password, verification or login code",
    "balance": "Only a balance or mini statement notice with no new transaction",
    "promo": "An advertisement, offer, reminder or other non-transaction message",
}


@api.post("/parse")
async def parse(body: ParseIn):
    if body.source == "sms":
        r = await jev_ask({"sms": body.text[:1000]}, {"kind": Choice(
            instructions="What kind of Pakistani bank / JazzCash / Easypaisa SMS is this?", criteria=SMS_KINDS)})
        if r:
            k = r.choices["kind"]
            if k.choice != "spend" and k.confidence >= 0.6:
                return {"amount": 0, "category": "other", "note": "", "payment_method": "cash", "member": "",
                        "is_spend": False, "sms_kind": k.choice}
    try:
        return {**(await parse_text(body.text)), "is_spend": True, "sms_kind": "spend" if body.source == "sms" else None}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("parse failed")
        raise HTTPException(502, "مددگار ابھی دستیاب نہیں، تھوڑی دیر بعد کوشش کریں") from e


@api.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    data = await audio.read()
    if len(data) < 2000:
        return {"text": ""}
    suffix = Path(audio.filename or "rec.m4a").suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        stt = OpenAISpeechToText(api_key=LLM_KEY)
        with open(path, "rb") as f:
            resp = await stt.transcribe(file=f, model="gpt-4o-mini-transcribe", response_format="json",
                                        language="ur", temperature=0.0,
                                        prompt="گھر کا خرچ: دودھ، سبزی، آٹا، بجلی کا بل، پیٹرول، روپے")
        return {"text": (resp.text or "").strip()}
    except Exception as e:
        logger.exception("transcribe failed")
        raise HTTPException(502, "آواز سمجھ نہیں آئی، دوبارہ بولیں") from e
    finally:
        os.unlink(path)


# ---------- Udhaar ----------
@api.get("/udhaar")
async def list_udhaar():
    docs = await db.udhaar.find({"settled": False}).sort("date", -1).to_list(1000)
    entries = [UdhaarEntry.from_mongo(d).model_dump() for d in docs]
    people: dict[str, dict] = {}
    for e in entries:
        p = people.setdefault(e["person"], {"name": e["person"], "balance": 0.0, "entries": []})
        p["balance"] += e["amount"] if e["kind"] == "lena" else -e["amount"]
        p["entries"].append(e)
    plist = sorted(people.values(), key=lambda x: -abs(x["balance"]))
    return {
        "total_lena": sum(p["balance"] for p in plist if p["balance"] > 0),
        "total_dena": -sum(p["balance"] for p in plist if p["balance"] < 0),
        "people": plist,
    }


@api.post("/udhaar")
async def add_udhaar(body: UdhaarIn):
    u = UdhaarEntry(**body.model_dump(), date=today_str())
    u.person = u.person.strip()
    res = await db.udhaar.insert_one(u.to_mongo())
    u.id = str(res.inserted_id)
    return u.model_dump()


@api.post("/udhaar/settle")
async def settle_udhaar(body: SettleIn):
    r = await db.udhaar.update_many({"person": body.person, "settled": False}, {"$set": {"settled": True}})
    return {"ok": True, "count": r.modified_count}


@api.delete("/udhaar/{uid}")
async def delete_udhaar(uid: str):
    await db.udhaar.delete_one({"_id": oid(uid)})
    return {"ok": True}


# ---------- Bills ----------
def bill_view(b: Bill) -> dict:
    now = now_pk()
    ym = month_str()
    last = calendar.monthrange(now.year, now.month)[1]
    due = min(b.due_day, last)
    d = b.model_dump()
    d["paid_this_month"] = ym in b.paid_months
    d["days_left"] = due - now.day
    return d


@api.get("/bills")
async def list_bills():
    docs = await db.bills.find({}).to_list(200)
    views = [bill_view(Bill.from_mongo(d)) for d in docs]
    return sorted(views, key=lambda x: (x["paid_this_month"], x["days_left"]))


@api.post("/bills")
async def add_bill(body: BillIn):
    b = Bill(**body.model_dump())
    res = await db.bills.insert_one(b.to_mongo())
    b.id = str(res.inserted_id)
    return bill_view(b)


@api.post("/bills/{bid}/pay")
async def pay_bill(bid: str):
    doc = await db.bills.find_one({"_id": oid(bid)})
    if not doc:
        raise HTTPException(404, "بل نہیں ملا")
    b = Bill.from_mongo(doc)
    ym = month_str()
    if ym not in b.paid_months:
        await db.bills.update_one({"_id": oid(bid)}, {"$addToSet": {"paid_months": ym}})
        if b.amount > 0:
            await insert_expense(ExpenseIn(amount=b.amount, category="bills", note=f"{b.name} کا بل"))
    doc = await db.bills.find_one({"_id": oid(bid)})
    return bill_view(Bill.from_mongo(doc))


@api.delete("/bills/{bid}")
async def delete_bill(bid: str):
    await db.bills.delete_one({"_id": oid(bid)})
    return {"ok": True}


# ---------- Summary & Report ----------
@api.get("/summary")
async def summary():
    s = await get_settings_doc()
    now = now_pk()
    ym, today = month_str(), today_str()
    month_docs = await db.expenses.find({"date": {"$regex": f"^{ym}"}}).to_list(5000)
    month_spent = sum(d["amount"] for d in month_docs)
    today_spent = sum(d["amount"] for d in month_docs if d["date"] == today)
    bills = [bill_view(Bill.from_mongo(d)) for d in await db.bills.find({}).to_list(200)]
    unpaid = [b for b in bills if not b["paid_this_month"]]
    unpaid_total = sum(b["amount"] for b in unpaid)
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    days_left = days_in_month - now.day + 1
    available = s.monthly_budget - (month_spent - today_spent) - unpaid_total
    daily_limit = max(available, 0) / days_left
    recent = await db.expenses.find({}).sort([("date", -1), ("created_at", -1)]).to_list(5)
    upcoming = sorted([b for b in unpaid if b["days_left"] <= 7], key=lambda x: x["days_left"])
    return {
        "monthly_budget": s.monthly_budget,
        "month_spent": month_spent,
        "today_spent": today_spent,
        "daily_limit": round(daily_limit),
        "today_left": round(daily_limit - today_spent),
        "days_left": days_left,
        "unpaid_bills_total": unpaid_total,
        "recent": [Expense.from_mongo(d).model_dump() for d in recent],
        "upcoming_bills": upcoming,
    }


@api.get("/report")
async def report(month: Optional[str] = None):
    ym = month or month_str()
    docs = await db.expenses.find({"date": {"$regex": f"^{ym}"}}).to_list(5000)
    total = sum(d["amount"] for d in docs)

    def group(key: str):
        g: dict[str, float] = {}
        for d in docs:
            k = d.get(key) or ""
            g[k] = g.get(k, 0) + d["amount"]
        return [{"key": k, "amount": v} for k, v in sorted(g.items(), key=lambda x: -x[1])]

    s = await get_settings_doc()
    return {"month": ym, "total": total, "count": len(docs), "budget": s.monthly_budget,
            "by_category": group("category"), "by_method": group("payment_method"), "by_member": group("member")}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await get_jev_client().aclose()
