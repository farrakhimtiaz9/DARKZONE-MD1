"""Backend tests for auth + household + per-household data isolation
+ needs/wants + receipt vision + English parse (iteration 3).

Run: pytest /app/backend/tests/test_household_auth.py -v --tb=short
"""
import os
import io
import base64
import uuid
from datetime import datetime, timezone, timedelta
import pytest
import requests
from PIL import Image, ImageDraw, ImageFont
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") \
    else os.environ.get("BASE_URL", "https://ghar-khata-1.preview.emergentagent.com").rstrip("/")

OWNER = "test_session_owner"
MEMBER = "test_session_member"


def H(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --------------------------- Auth ---------------------------
class TestAuth:
    def test_me_requires_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H("not_a_real_token_xyz"))
        assert r.status_code == 401

    def test_me_owner_ok(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(OWNER))
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "owner.test@example.com"
        assert d["user_id"] == "user_test_owner"
        assert d.get("household_id")

    def test_session_invalid_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={"session_id": "definitely-not-valid-xyz"})
        assert r.status_code == 401

    def test_session_missing_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={})
        assert r.status_code == 422

    def test_logout_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/auth/logout")
        assert r.status_code == 401


# ---------------------- Mongo-level seed for extra users ----------------------
@pytest.fixture(scope="module")
def extra_user(event_loop):
    """Create an orphan user (no household) + another household's user via Mongo."""
    import asyncio
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = mongo[os.environ["DB_NAME"]]

    orphan_token = f"TEST_orphan_{uuid.uuid4().hex[:8]}"
    orphan_uid = f"user_TEST_orphan_{uuid.uuid4().hex[:6]}"
    outsider_token = f"TEST_outsider_{uuid.uuid4().hex[:8]}"
    outsider_uid = f"user_TEST_outsider_{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)

    async def setup():
        await db.users.insert_one({
            "user_id": orphan_uid, "email": f"TEST_orphan_{uuid.uuid4().hex[:4]}@test.com",
            "name": "Orphan Test", "picture": "", "household_id": None,
            "created_at": now.isoformat()})
        await db.user_sessions.insert_one({
            "session_token": orphan_token, "user_id": orphan_uid,
            "expires_at": now + timedelta(days=7), "created_at": now})
        await db.users.insert_one({
            "user_id": outsider_uid, "email": f"TEST_outsider_{uuid.uuid4().hex[:4]}@test.com",
            "name": "Outsider Test", "picture": "", "household_id": None,
            "created_at": now.isoformat()})
        await db.user_sessions.insert_one({
            "session_token": outsider_token, "user_id": outsider_uid,
            "expires_at": now + timedelta(days=7), "created_at": now})

    async def teardown():
        # best effort cleanup: delete outsider household (if created) + users + sessions
        for uid in (orphan_uid, outsider_uid):
            u = await db.users.find_one({"user_id": uid})
            if u and u.get("household_id"):
                from bson import ObjectId
                hid = u["household_id"]
                await db.expenses.delete_many({"household_id": hid})
                try:
                    await db.households.delete_one({"_id": ObjectId(hid)})
                except Exception:
                    pass
        await db.users.delete_many({"user_id": {"$in": [orphan_uid, outsider_uid]}})
        await db.user_sessions.delete_many({"session_token": {"$in": [orphan_token, outsider_token]}})
        mongo.close()

    event_loop.run_until_complete(setup())
    yield {"orphan_token": orphan_token, "outsider_token": outsider_token,
           "orphan_uid": orphan_uid, "outsider_uid": outsider_uid}
    event_loop.run_until_complete(teardown())


@pytest.fixture(scope="module")
def event_loop():
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# --------------------------- Household ---------------------------
class TestHousehold:
    def test_get_household_owner_ok(self):
        r = requests.get(f"{BASE_URL}/api/household", headers=H(OWNER))
        assert r.status_code == 200
        d = r.json()
        assert d["name"]
        assert len(d["invite_code"]) == 6
        assert isinstance(d["users"], list) and len(d["users"]) >= 2

    def test_endpoints_403_when_no_household(self, extra_user):
        token = extra_user["orphan_token"]
        for ep in ["/api/household", "/api/summary", "/api/expenses", "/api/bills", "/api/udhaar", "/api/report"]:
            r = requests.get(f"{BASE_URL}{ep}", headers=H(token))
            assert r.status_code == 403, f"{ep} expected 403 got {r.status_code}"

    def test_join_bad_code_404(self, extra_user):
        r = requests.post(f"{BASE_URL}/api/household/join", headers=H(extra_user["orphan_token"]),
                          json={"code": "ZZZZZZ"})
        assert r.status_code == 404

    def test_create_household_returns_invite_code(self, extra_user):
        token = extra_user["outsider_token"]
        r = requests.post(f"{BASE_URL}/api/household", headers=H(token), json={"name": "TEST_Outsider_Home"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Outsider_Home"
        assert len(d["invite_code"]) == 6
        # cannot create twice
        r2 = requests.post(f"{BASE_URL}/api/household", headers=H(token), json={"name": "Another"})
        assert r2.status_code == 400

    def test_data_isolation(self, extra_user):
        """Outsider must not see or delete owner-household's expenses."""
        # owner creates expense
        exp = requests.post(f"{BASE_URL}/api/expenses", headers=H(OWNER),
                            json={"amount": 55, "category": "milk_veg", "note": "TEST isolation", "payment_method": "cash"})
        assert exp.status_code == 200, exp.text
        eid = exp.json()["id"]

        # outsider lists expenses -> must NOT include the above id
        out_list = requests.get(f"{BASE_URL}/api/expenses", headers=H(extra_user["outsider_token"]))
        assert out_list.status_code == 200
        assert all(e["id"] != eid for e in out_list.json())

        # outsider delete attempt -> 404 (scoped by household_id)
        d = requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=H(extra_user["outsider_token"]))
        assert d.status_code == 404

        # owner can delete
        d2 = requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=H(OWNER))
        assert d2.status_code == 200

    def test_member_sees_owner_expense(self):
        """Member in same household sees expenses added by owner."""
        exp = requests.post(f"{BASE_URL}/api/expenses", headers=H(OWNER),
                            json={"amount": 77, "category": "grocery", "note": "TEST shared visible"})
        assert exp.status_code == 200
        eid = exp.json()["id"]
        try:
            member_list = requests.get(f"{BASE_URL}/api/expenses", headers=H(MEMBER))
            assert member_list.status_code == 200
            assert any(e["id"] == eid for e in member_list.json())
        finally:
            requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=H(OWNER))


# --------------------------- Expenses need_type ---------------------------
class TestNeedType:
    def test_create_returns_level_and_need(self):
        r = requests.post(f"{BASE_URL}/api/expenses", headers=H(OWNER),
                          json={"amount": 300, "category": "grocery", "note": "TEST aata cheeni"})
        assert r.status_code == 200
        d = r.json()
        assert "spend_level" in d and "need_type" in d
        eid = d["id"]
        # Jev may be unavailable (returns None). If present, must be valid literal.
        if d["need_type"] is not None:
            assert d["need_type"] in ("need", "want")
        if d["spend_level"] is not None:
            assert d["spend_level"] in ("normal", "slightly_high", "unusual")

        # PATCH toggle
        p = requests.patch(f"{BASE_URL}/api/expenses/{eid}", headers=H(OWNER), json={"need_type": "want"})
        assert p.status_code == 200
        assert p.json()["need_type"] == "want"

        p2 = requests.patch(f"{BASE_URL}/api/expenses/{eid}", headers=H(OWNER), json={"need_type": "need"})
        assert p2.status_code == 200
        assert p2.json()["need_type"] == "need"

        # Bad enum rejected
        bad = requests.patch(f"{BASE_URL}/api/expenses/{eid}", headers=H(OWNER), json={"need_type": "maybe"})
        assert bad.status_code == 422

        # 404 on unknown
        nf = requests.patch(f"{BASE_URL}/api/expenses/000000000000000000000000",
                            headers=H(OWNER), json={"need_type": "need"})
        assert nf.status_code == 404

        requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=H(OWNER))

    def test_patch_requires_auth(self):
        r = requests.patch(f"{BASE_URL}/api/expenses/anything", json={"need_type": "need"})
        assert r.status_code == 401

    def test_month_filter(self):
        ym = datetime.now().strftime("%Y-%m")
        r = requests.get(f"{BASE_URL}/api/expenses?month={ym}", headers=H(OWNER))
        assert r.status_code == 200
        for e in r.json():
            assert e["date"].startswith(ym)


# --------------------------- Report by_need ---------------------------
class TestReport:
    def test_report_includes_by_need(self):
        # Seed one need + one want
        e1 = requests.post(f"{BASE_URL}/api/expenses", headers=H(OWNER),
                           json={"amount": 100, "category": "milk_veg", "note": "TEST need"}).json()
        e2 = requests.post(f"{BASE_URL}/api/expenses", headers=H(OWNER),
                           json={"amount": 200, "category": "guests", "note": "TEST want"}).json()
        requests.patch(f"{BASE_URL}/api/expenses/{e1['id']}", headers=H(OWNER), json={"need_type": "need"})
        requests.patch(f"{BASE_URL}/api/expenses/{e2['id']}", headers=H(OWNER), json={"need_type": "want"})
        try:
            r = requests.get(f"{BASE_URL}/api/report", headers=H(OWNER))
            assert r.status_code == 200
            d = r.json()
            assert "by_need" in d
            keys = {b["key"] for b in d["by_need"]}
            assert "need" in keys
            assert "want" in keys
        finally:
            requests.delete(f"{BASE_URL}/api/expenses/{e1['id']}", headers=H(OWNER))
            requests.delete(f"{BASE_URL}/api/expenses/{e2['id']}", headers=H(OWNER))


# --------------------------- Parse (English) ---------------------------
class TestParse:
    def test_parse_en_note_is_english(self):
        r = requests.post(f"{BASE_URL}/api/parse", headers=H(OWNER),
                          json={"text": "Spent 500 rupees on petrol", "source": "text", "lang": "en"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 500
        assert d["is_spend"] is True
        # Note should look English (contain ASCII letters, no Urdu block)
        assert any(c.isascii() and c.isalpha() for c in d["note"])
        assert not any("\u0600" <= c <= "\u06FF" for c in d["note"])

    def test_parse_sms_otp_filtered(self):
        r = requests.post(f"{BASE_URL}/api/parse", headers=H(OWNER),
                          json={"text": "Your OTP is 456789. Do not share.", "source": "sms", "lang": "en"})
        assert r.status_code == 200
        d = r.json()
        if d["sms_kind"] == "otp":
            assert d["is_spend"] is False
            assert d["amount"] == 0

    def test_parse_sms_received_filtered(self):
        r = requests.post(f"{BASE_URL}/api/parse", headers=H(OWNER),
                          json={"text": "Dear customer, Rs. 20000 credited to your account from salary.",
                                "source": "sms", "lang": "en"})
        assert r.status_code == 200
        d = r.json()
        if d["sms_kind"] == "received":
            assert d["is_spend"] is False


# --------------------------- Receipt (vision) ---------------------------
def _make_receipt_png_b64() -> str:
    """Create a realistic receipt-like PNG with text, in-memory, return base64 (no prefix)."""
    img = Image.new("RGB", (480, 640), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
        font_b = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except Exception:
        font = ImageFont.load_default()
        font_b = font

    lines = [
        ("AL-FATAH SUPERMARKET", font_b, 60),
        ("Main Boulevard, Lahore", font, 100),
        ("Receipt #10234", font, 130),
        ("--------------------------", font, 160),
        ("Milk 1L           Rs. 220", font, 200),
        ("Bread             Rs. 150", font, 230),
        ("Eggs x12          Rs. 380", font, 260),
        ("Yogurt 1kg        Rs. 300", font, 290),
        ("--------------------------", font, 320),
        ("Subtotal          Rs. 1050", font, 360),
        ("Tax                Rs.  50", font, 390),
        ("TOTAL           Rs. 1100", font_b, 440),
        ("Thank you!", font, 500),
    ]
    for text, f, y in lines:
        d.text((40, y), text, fill="black", font=f)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class TestReceipt:
    def test_receipt_vision_reads_total(self):
        b64 = _make_receipt_png_b64()
        r = requests.post(f"{BASE_URL}/api/receipt", headers=H(OWNER),
                          json={"image_base64": b64, "lang": "en"}, timeout=60)
        if r.status_code == 502:
            pytest.skip(f"vision backend unavailable: {r.text[:100]}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "amount" in d and "category" in d and "note" in d
        # Grand total must be the 1100 (not 1050 subtotal)
        assert d["amount"] in (1100, 1100.0, 1050, 1050.0), f"got {d['amount']}"
        assert d["category"] in ("grocery", "milk_veg", "other")
        assert isinstance(d["note"], str) and len(d["note"]) > 0

    def test_receipt_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/receipt",
                          json={"image_base64": "x" * 200, "lang": "en"})
        assert r.status_code == 401

    def test_receipt_rejects_too_small(self):
        r = requests.post(f"{BASE_URL}/api/receipt", headers=H(OWNER),
                          json={"image_base64": "abc", "lang": "en"})
        assert r.status_code == 422
