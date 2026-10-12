from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import json
import re
import uuid
import random
import logging
import tempfile
import calendar
import httpx
from pathlib import Path
from typing import Annotated, Any, List, Optional, Literal
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone, ImageContent
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
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

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
NEED_CRITERIA = {
    "need": "Essential for running the household: food staples, milk, vegetables, utility bills, medicine, school fees, basic transport, rent",
    "want": "Nice to have / optional: eating out, takeaway, snacks, sweets, gadgets, extra clothes or shoes, outings, decor, luxury items",
}
SPEND_LEVELS = ["normal", "slightly_high", "unusual"]
SMS_KINDS = {
    "spend": "Money went OUT: a purchase, payment, bill payment, transfer sent, cash withdrawal or mobile load",
    "received": "Money came IN: amount received, salary credited, refund, transfer received",
    "otp": "A one-time password, verification or login code",
    "balance": "Only a balance or mini statement notice with no new transaction",
    "promo": "An advertisement, offer, reminder or other non-transaction message",
}


# ---------- Mongo helpers ----------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        return self.model_dump(by_alias=True, exclude={"id"})

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
        raise HTTPException(404, "not found")


# ---------- Models ----------
class User(BaseDocument):
    user_id: str
    email: str
    name: str = ""
    picture: str = ""
    household_id: Optional[str] = None
    created_at: str


class Household(BaseDocument):
    name: str
    invite_code: str
    owner_id: str
    monthly_budget: float = 50000
    members: List[str] = Field(default_factory=list)
    created_at: str


class Expense(BaseDocument):
    household_id: str
    amount: float
    category: str = "other"
    note: str = ""
    payment_method: str = "cash"
    member: str = ""
    added_by: str = ""
    date: str
    created_at: str
    spend_level: Optional[str] = None
    need_type: Optional[str] = None


class ExpenseIn(BaseModel):
    amount: float = Field(gt=0)
    category: Literal[tuple(CATEGORIES)] = "other"
    note: str = ""
    payment_method: Literal[tuple(METHODS)] = "cash"
    member: str = ""
    date: Optional[str] = None


class NeedIn(BaseModel):
    need_type: Literal["need", "want"]


class UdhaarEntry(BaseDocument):
    household_id: str
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
    household_id: str
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


class SettingsIn(BaseModel):
    name: Optional[str] = None
    monthly_budget: float = Field(ge=0)
    members: List[str]


class Lang(BaseModel):
    lang: Literal["ur", "en"] = "ur"


class ParseIn(Lang):
    text: str = Field(min_length=1)
    source: Literal["text", "voice", "sms"] = "text"


class ReceiptIn(Lang):
    image_base64: str = Field(min_length=100, max_length=12_000_000)


class CategorizeIn(BaseModel):
    note: str = Field(min_length=1, max_length=300)


class SessionIn(BaseModel):
    session_id: str = Field(min_length=1)


class HouseholdCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class JoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=10)


# ---------- Auth ----------
def first_name(u: User) -> str:
    return (u.name or u.email.split("@")[0]).split(" ")[0]


async def current_user(request: Request) -> User:
    auth = request.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    if not token:
        raise HTTPException(401, "not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "session invalid")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "session expired")
    doc = await db.users.find_one({"user_id": sess["user_id"]})
    if not doc:
        raise HTTPException(401, "user not found")
    return User.from_mongo(doc)


async def current_household(user: User = Depends(current_user)) -> Household:
    if not user.household_id:
        raise HTTPException(403, "no household")
    doc = await db.households.find_one({"_id": oid(user.household_id)})
    if not doc:
        raise HTTPException(403, "no household")
    return Household.from_mongo(doc)


def user_view(u: User) -> dict:
    return {"user_id": u.user_id, "email": u.email, "name": u.name, "picture": u.picture, "household_id": u.household_id}


@api.post("/auth/session")
async def auth_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=20) as hc:
        r = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "invalid session_id")
    data = r.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one({"email": email}, {"$set": {"name": data.get("name", ""), "picture": data.get("picture", "")}})
    else:
        u = User(user_id=f"user_{uuid.uuid4().hex[:12]}", email=email, name=data.get("name", ""),
                 picture=data.get("picture", ""), created_at=datetime.now(timezone.utc).isoformat())
        await db.users.insert_one(u.to_mongo())
    user = User.from_mongo(await db.users.find_one({"email": email}))
    token = data["session_token"]
    now = datetime.now(timezone.utc)
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$set": {"session_token": token, "user_id": user.user_id, "expires_at": now + timedelta(days=7), "created_at": now}},
        upsert=True)
    return {"session_token": token, "user": user_view(user)}


@api.get("/auth/me")
async def auth_me(user: User = Depends(current_user)):
    return user_view(user)


@api.post("/auth/logout")
async def auth_logout(request: Request, user: User = Depends(current_user)):
    token = request.headers.get("Authorization", "")[7:].strip()
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Household ----------
async def new_code() -> str:
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    while True:
        code = "".join(random.choice(letters) for _ in range(6))
        if not await db.households.find_one({"invite_code": code}):
            return code


async def household_view(h: Household) -> dict:
    users = await db.users.find({"household_id": h.id}).to_list(50)
    return {**h.model_dump(), "users": [{"name": d.get("name", ""), "email": d["email"], "picture": d.get("picture", "")} for d in users]}


@api.post("/household")
async def create_household(body: HouseholdCreate, user: User = Depends(current_user)):
    if user.household_id:
        raise HTTPException(400, "already in a household")
    h = Household(name=body.name.strip(), invite_code=await new_code(), owner_id=user.user_id,
                  members=[first_name(user)], created_at=datetime.now(timezone.utc).isoformat())
    res = await db.households.insert_one(h.to_mongo())
    h.id = str(res.inserted_id)
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"household_id": h.id}})
    return await household_view(h)


@api.post("/household/join")
async def join_household(body: JoinIn, user: User = Depends(current_user)):
    doc = await db.households.find_one({"invite_code": body.code.strip().upper()})
    if not doc:
        raise HTTPException(404, "invite code not found")
    h = Household.from_mongo(doc)
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"household_id": h.id}})
    fn = first_name(user)
    if fn not in h.members:
        await db.households.update_one({"_id": oid(h.id)}, {"$push": {"members": fn}})
    return await household_view(Household.from_mongo(await db.households.find_one({"_id": oid(h.id)})))


@api.post("/household/leave")
async def leave_household(user: User = Depends(current_user)):
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"household_id": None}})
    return {"ok": True}


@api.get("/household")
async def get_household(h: Household = Depends(current_household)):
    return await household_view(h)


@api.get("/settings")
async def read_settings(h: Household = Depends(current_household)):
    return {"name": h.name, "monthly_budget": h.monthly_budget, "members": h.members, "invite_code": h.invite_code}


@api.put("/settings")
async def update_settings(body: SettingsIn, h: Household = Depends(current_household)):
    upd: dict[str, Any] = {"monthly_budget": body.monthly_budget, "members": [m.strip() for m in body.members if m.strip()]}
    if body.name and body.name.strip():
        upd["name"] = body.name.strip()
    await db.households.update_one({"_id": oid(h.id)}, {"$set": upd})
    return await read_settings(Household.from_mongo(await db.households.find_one({"_id": oid(h.id)})))


# ---------- Jev ----------
async def jev_ask(state: dict, questions: dict):
    try:
        return await get_jev_client().system_one(model="jev-latest", state=state, questions=questions)
    except TypeSafeAPIError as exc:
        logger.warning("jev api error %s %s", exc.status, jev_error_code(exc))
    except TypeSafeError as exc:
        logger.warning("jev unavailable %s", exc)
    return None


# ---------- Expenses ----------
async def insert_expense(h: Household, body: ExpenseIn, added_by: str = "", spend_level=None, need_type=None) -> dict:
    e = Expense(household_id=h.id, **body.model_dump(exclude={"date"}), date=body.date or today_str(), added_by=added_by,
                created_at=datetime.now(timezone.utc).isoformat(), spend_level=spend_level, need_type=need_type)
    res = await db.expenses.insert_one(e.to_mongo())
    e.id = str(res.inserted_id)
    return e.model_dump()


async def classify_expense(h: Household, body: ExpenseIn) -> tuple[Optional[str], Optional[str]]:
    s = await compute_summary(h)
    state = {"new_expense_pkr": body.amount, "category": body.category, "note": body.note,
             "already_spent_today_pkr": s["today_spent"], "comfortable_daily_limit_pkr": s["daily_limit"],
             "monthly_budget_pkr": s["monthly_budget"], "spent_this_month_pkr": s["month_spent"]}
    r = await jev_ask(state, {
        "level": Score(instructions="For a Pakistani household, how unusual is this new expense compared with the comfortable daily limit, "
                                    "the budget and what the category normally costs? Planned bills and school fees are normal.",
                       criteria=SPEND_LEVELS),
        "need": Choice(instructions="Is this household expense an essential need or an optional want?", criteria=NEED_CRITERIA),
    })
    if not r:
        return None, None
    probs = r.scores["level"].probabilities
    return SPEND_LEVELS[max(probs, key=probs.get)], r.choices["need"].choice


@api.get("/expenses")
async def list_expenses(month: Optional[str] = None, limit: int = 300, h: Household = Depends(current_household)):
    q: dict[str, Any] = {"household_id": h.id}
    if month:
        q["date"] = {"$regex": f"^{month}"}
    docs = await db.expenses.find(q).sort([("date", -1), ("created_at", -1)]).to_list(limit)
    return [Expense.from_mongo(d).model_dump() for d in docs]


@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: User = Depends(current_user), h: Household = Depends(current_household)):
    level, need = await classify_expense(h, body)
    return await insert_expense(h, body, first_name(user), level, need)


@api.patch("/expenses/{eid}")
async def set_need(eid: str, body: NeedIn, h: Household = Depends(current_household)):
    r = await db.expenses.update_one({"_id": oid(eid), "household_id": h.id}, {"$set": {"need_type": body.need_type}})
    if not r.matched_count:
        raise HTTPException(404, "not found")
    return Expense.from_mongo(await db.expenses.find_one({"_id": oid(eid)})).model_dump()


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, h: Household = Depends(current_household)):
    r = await db.expenses.delete_one({"_id": oid(eid), "household_id": h.id})
    if not r.deleted_count:
        raise HTTPException(404, "not found")
    return {"ok": True}


@api.post("/categorize")
async def categorize(body: CategorizeIn, user: User = Depends(current_user)):
    r = await jev_ask({"expense_note": body.note}, {"category": Choice(
        instructions="Which household expense category does this Urdu / Roman Urdu / English note belong to?",
        criteria=CATEGORY_CRITERIA)})
    if not r:
        return {"category": None, "confidence": 0, "ai_classified": False}
    c = r.choices["category"]
    return {"category": c.choice, "confidence": c.confidence, "ai_classified": True}


# ---------- Smart helper (text / SMS / receipt) ----------
def parse_system(lang: str, members: list[str]) -> str:
    note_lang = "simple Urdu (Nastaliq script)" if lang == "ur" else "simple English"
    return f"""You read short Urdu, Roman Urdu or English sentences, Pakistani bank / JazzCash / Easypaisa SMS, or shop receipt photos, and extract ONE household expense.
Return ONLY a JSON object, no markdown:
{{"amount": number (PKR, 0 if not found), "category": one of {CATEGORIES}, "note": short {note_lang} description, max 6 words,
"payment_method": one of {METHODS} (cash if unclear; jazzcash/easypaisa/bank if mentioned), "member": family member who spent if mentioned else ""}}
Category hints: grocery=سودا سلف, آٹا, چینی, گھی, کریانہ; milk_veg=دودھ, سبزی, پھل, گوشت, انڈے; bills=بجلی, گیس, انٹرنیٹ, موبائل لوڈ, پانی;
transport=پیٹرول, رکشہ, کرایہ; health=دوا, ڈاکٹر; education=اسکول, فیس, کتابیں, ٹیوشن; guests=مہمان, دعوت, تحفہ; clothes=کپڑے, جوتے, درزی.
Understand Urdu number words (سو=100, ہزار=1000, ڈیڑھ سو=150, ڈھائی سو=250). Ignore account balances in SMS; use the transaction amount.
For receipts use the final grand total (after discounts/tax) and summarise main items in the note.
Known family members (use exact spelling if mentioned): {members}"""


async def run_parse(system: str, msg: UserMessage) -> dict:
    chat = LlmChat(api_key=LLM_KEY, session_id=f"parse-{uuid.uuid4()}", system_message=system).with_model("openai", "gpt-5.2")
    out = ""
    async for ev in chat.stream_message(msg):
        if isinstance(ev, TextDelta):
            out += ev.content
        elif isinstance(ev, StreamDone):
            break
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        raise HTTPException(422, "could not understand")
    data: dict[str, Any] = json.loads(m.group(0))
    try:
        amount = float(data.get("amount") or 0)
    except (TypeError, ValueError):
        amount = 0
    return {"amount": amount,
            "category": data.get("category") if data.get("category") in CATEGORIES else "other",
            "note": str(data.get("note") or ""),
            "payment_method": data.get("payment_method") if data.get("payment_method") in METHODS else "cash",
            "member": str(data.get("member") or ""), "is_spend": True, "sms_kind": None}


@api.post("/parse")
async def parse(body: ParseIn, h: Household = Depends(current_household)):
    if body.source == "sms":
        r = await jev_ask({"sms": body.text[:1000]}, {"kind": Choice(
            instructions="What kind of Pakistani bank / JazzCash / Easypaisa SMS is this?", criteria=SMS_KINDS)})
        if r:
            k = r.choices["kind"]
            if k.choice != "spend" and k.confidence >= 0.6:
                return {"amount": 0, "category": "other", "note": "", "payment_method": "cash", "member": "",
                        "is_spend": False, "sms_kind": k.choice}
    try:
        res = await run_parse(parse_system(body.lang, h.members), UserMessage(text=body.text))
        if body.source == "sms":
            res["sms_kind"] = "spend"
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("parse failed")
        raise HTTPException(502, "helper unavailable") from e


@api.post("/receipt")
async def read_receipt(body: ReceiptIn, h: Household = Depends(current_household)):
    b64 = body.image_base64.split(",", 1)[-1]
    try:
        msg = UserMessage(text="Read this shop receipt and extract the expense JSON.", file_contents=[ImageContent(image_base64=b64)])
        return await run_parse(parse_system(body.lang, h.members), msg)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("receipt failed")
        raise HTTPException(502, "could not read receipt") from e


@api.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), user: User = Depends(current_user)):
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
            resp = await stt.transcribe(file=f, model="gpt-4o-mini-transcribe", response_format="json", temperature=0.0,
                                        prompt="گھر کا خرچ: دودھ، سبزی، آٹا، بجلی کا بل، پیٹرول، روپے. Household expense in rupees.")
        return {"text": (resp.text or "").strip()}
    except Exception as e:
        logger.exception("transcribe failed")
        raise HTTPException(502, "could not understand audio") from e
    finally:
        os.unlink(path)


# ---------- Udhaar ----------
@api.get("/udhaar")
async def list_udhaar(h: Household = Depends(current_household)):
    docs = await db.udhaar.find({"household_id": h.id, "settled": False}).sort("date", -1).to_list(1000)
    people: dict[str, dict] = {}
    for d in docs:
        e = UdhaarEntry.from_mongo(d).model_dump()
        p = people.setdefault(e["person"], {"name": e["person"], "balance": 0.0, "entries": []})
        p["balance"] += e["amount"] if e["kind"] == "lena" else -e["amount"]
        p["entries"].append(e)
    plist = sorted(people.values(), key=lambda x: -abs(x["balance"]))
    return {"total_lena": sum(p["balance"] for p in plist if p["balance"] > 0),
            "total_dena": -sum(p["balance"] for p in plist if p["balance"] < 0), "people": plist}


@api.post("/udhaar")
async def add_udhaar(body: UdhaarIn, h: Household = Depends(current_household)):
    u = UdhaarEntry(household_id=h.id, **{**body.model_dump(), "person": body.person.strip()}, date=today_str())
    res = await db.udhaar.insert_one(u.to_mongo())
    u.id = str(res.inserted_id)
    return u.model_dump()


@api.post("/udhaar/settle")
async def settle_udhaar(body: SettleIn, h: Household = Depends(current_household)):
    r = await db.udhaar.update_many({"household_id": h.id, "person": body.person, "settled": False}, {"$set": {"settled": True}})
    return {"ok": True, "count": r.modified_count}


@api.delete("/udhaar/{uid}")
async def delete_udhaar(uid: str, h: Household = Depends(current_household)):
    await db.udhaar.delete_one({"_id": oid(uid), "household_id": h.id})
    return {"ok": True}


# ---------- Bills ----------
def bill_view(b: Bill) -> dict:
    now = now_pk()
    due = min(b.due_day, calendar.monthrange(now.year, now.month)[1])
    d = b.model_dump()
    d["paid_this_month"] = month_str() in b.paid_months
    d["days_left"] = due - now.day
    return d


@api.get("/bills")
async def list_bills(h: Household = Depends(current_household)):
    docs = await db.bills.find({"household_id": h.id}).to_list(200)
    return sorted([bill_view(Bill.from_mongo(d)) for d in docs], key=lambda x: (x["paid_this_month"], x["days_left"]))


@api.post("/bills")
async def add_bill(body: BillIn, h: Household = Depends(current_household)):
    b = Bill(household_id=h.id, **body.model_dump())
    res = await db.bills.insert_one(b.to_mongo())
    b.id = str(res.inserted_id)
    return bill_view(b)


@api.post("/bills/{bid}/pay")
async def pay_bill(bid: str, user: User = Depends(current_user), h: Household = Depends(current_household)):
    doc = await db.bills.find_one({"_id": oid(bid), "household_id": h.id})
    if not doc:
        raise HTTPException(404, "bill not found")
    b = Bill.from_mongo(doc)
    ym = month_str()
    if ym not in b.paid_months:
        await db.bills.update_one({"_id": oid(bid)}, {"$addToSet": {"paid_months": ym}})
        if b.amount > 0:
            await insert_expense(h, ExpenseIn(amount=b.amount, category="bills", note=b.name), first_name(user), None, "need")
    return bill_view(Bill.from_mongo(await db.bills.find_one({"_id": oid(bid)})))


@api.delete("/bills/{bid}")
async def delete_bill(bid: str, h: Household = Depends(current_household)):
    await db.bills.delete_one({"_id": oid(bid), "household_id": h.id})
    return {"ok": True}


# ---------- Summary & Report ----------
async def compute_summary(h: Household) -> dict:
    now = now_pk()
    ym, today = month_str(), today_str()
    month_docs = await db.expenses.find({"household_id": h.id, "date": {"$regex": f"^{ym}"}}).to_list(5000)
    month_spent = sum(d["amount"] for d in month_docs)
    today_spent = sum(d["amount"] for d in month_docs if d["date"] == today)
    bills = [bill_view(Bill.from_mongo(d)) for d in await db.bills.find({"household_id": h.id}).to_list(200)]
    unpaid = [b for b in bills if not b["paid_this_month"]]
    unpaid_total = sum(b["amount"] for b in unpaid)
    days_left = calendar.monthrange(now.year, now.month)[1] - now.day + 1
    available = h.monthly_budget - (month_spent - today_spent) - unpaid_total
    daily_limit = max(available, 0) / days_left
    recent = await db.expenses.find({"household_id": h.id}).sort([("date", -1), ("created_at", -1)]).to_list(5)
    return {
        "household_name": h.name, "monthly_budget": h.monthly_budget, "month_spent": month_spent, "today_spent": today_spent,
        "daily_limit": round(daily_limit), "today_left": round(daily_limit - today_spent), "days_left": days_left,
        "unpaid_bills_total": unpaid_total,
        "recent": [Expense.from_mongo(d).model_dump() for d in recent],
        "upcoming_bills": sorted([b for b in unpaid if b["days_left"] <= 7], key=lambda x: x["days_left"]),
    }


@api.get("/summary")
async def summary(h: Household = Depends(current_household)):
    return await compute_summary(h)


@api.get("/report")
async def report(month: Optional[str] = None, h: Household = Depends(current_household)):
    ym = month or month_str()
    docs = await db.expenses.find({"household_id": h.id, "date": {"$regex": f"^{ym}"}}).to_list(5000)
    total = sum(d["amount"] for d in docs)

    def group(key: str):
        g: dict[str, float] = {}
        for d in docs:
            k = d.get(key) or ""
            g[k] = g.get(k, 0) + d["amount"]
        return [{"key": k, "amount": v} for k, v in sorted(g.items(), key=lambda x: -x[1])]

    return {"month": ym, "total": total, "count": len(docs), "budget": h.monthly_budget, "household_name": h.name,
            "by_category": group("category"), "by_method": group("payment_method"), "by_member": group("member"),
            "by_need": group("need_type")}


@api.get("/")
async def root():
    return {"message": "Ghar Khata"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.households.create_index("invite_code", unique=True)
    await db.expenses.create_index([("household_id", 1), ("date", -1)])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await get_jev_client().aclose()
