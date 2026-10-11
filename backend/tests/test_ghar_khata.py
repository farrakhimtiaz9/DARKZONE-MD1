"""Backend tests for 'گھر کھاتہ' Urdu household expense tracker."""
import io
import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://ghar-khata-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Root ----------
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "گھر کھاتہ" in r.text


# ---------- Settings ----------
class TestSettings:
    def test_get_defaults(self, s):
        r = s.get(f"{API}/settings")
        assert r.status_code == 200
        data = r.json()
        assert "monthly_budget" in data and "members" in data
        assert isinstance(data["members"], list)
        assert "_id" not in data

    def test_update_and_verify(self, s):
        payload = {"monthly_budget": 75000, "members": ["TEST_امی", "TEST_ابو", " "]}
        r = s.put(f"{API}/settings", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["monthly_budget"] == 75000
        # whitespace trimmed and empty removed
        assert "TEST_امی" in data["members"]
        assert "" not in data["members"]
        # Verify GET returns persisted
        g = s.get(f"{API}/settings").json()
        assert g["monthly_budget"] == 75000

    def test_update_negative_rejected(self, s):
        r = s.put(f"{API}/settings", json={"monthly_budget": -100, "members": ["x"]})
        assert r.status_code == 422


# ---------- Expenses ----------
class TestExpenses:
    created_id = None

    def test_create_expense(self, s):
        r = s.post(f"{API}/expenses", json={
            "amount": 500, "category": "grocery", "note": "TEST آٹا",
            "payment_method": "cash", "member": "TEST_امی"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 500
        assert d["category"] == "grocery"
        assert d["id"]
        TestExpenses.created_id = d["id"]

    def test_list_contains_created(self, s):
        r = s.get(f"{API}/expenses")
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert TestExpenses.created_id in ids

    def test_create_invalid_amount(self, s):
        r = s.post(f"{API}/expenses", json={"amount": 0, "category": "grocery"})
        assert r.status_code == 422

    def test_create_invalid_category(self, s):
        r = s.post(f"{API}/expenses", json={"amount": 50, "category": "zzz"})
        assert r.status_code == 422

    def test_list_month_filter(self, s):
        ym = datetime.utcnow().strftime("%Y-%m")
        r = s.get(f"{API}/expenses?month={ym}")
        assert r.status_code == 200
        for e in r.json():
            assert e["date"].startswith(ym)

    def test_delete_expense(self, s):
        assert TestExpenses.created_id
        r = s.delete(f"{API}/expenses/{TestExpenses.created_id}")
        assert r.status_code == 200

    def test_delete_missing(self, s):
        r = s.delete(f"{API}/expenses/000000000000000000000000")
        assert r.status_code == 404


# ---------- Parse (LLM) ----------
class TestParse:
    def test_parse_urdu_amount(self, s):
        r = s.post(f"{API}/parse", json={"text": "آج دودھ لایا پانچ سو کا"})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("amount", "category", "note", "payment_method", "member"):
            assert k in d
        assert d["category"] in [
            "grocery","milk_veg","bills","transport","health","education","guests","clothes","other"
        ]
        assert d["payment_method"] in ["cash","jazzcash","easypaisa","bank"]

    def test_parse_sms(self, s):
        text = "Dear Customer, Rs.1,250 debited via JazzCash from your account. Avail balance: Rs.3,000"
        r = s.post(f"{API}/parse", json={"text": text})
        assert r.status_code == 200, r.text
        d = r.json()
        # amount should be the transaction (1250), not the balance (3000)
        assert d["amount"] in (1250, 1250.0)
        assert d["payment_method"] == "jazzcash"

    def test_parse_empty_rejected(self, s):
        r = s.post(f"{API}/parse", json={"text": ""})
        assert r.status_code == 422


# ---------- Transcribe ----------
class TestTranscribe:
    def test_tiny_audio_returns_empty(self, s):
        files = {"audio": ("rec.m4a", io.BytesIO(b"a" * 100), "audio/m4a")}
        r = requests.post(f"{API}/transcribe", files=files)
        assert r.status_code == 200
        assert r.json() == {"text": ""}


# ---------- Udhaar ----------
class TestUdhaar:
    person = f"TEST_P_{int(datetime.utcnow().timestamp())}"
    uid = None

    def test_add_udhaar(self, s):
        r = s.post(f"{API}/udhaar", json={
            "person": self.person, "amount": 1000, "kind": "lena", "note": "TEST"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["person"] == self.person
        assert d["kind"] == "lena"
        TestUdhaar.uid = d["id"]

    def test_list_shows_balance(self, s):
        r = s.get(f"{API}/udhaar")
        assert r.status_code == 200
        d = r.json()
        assert "total_lena" in d and "total_dena" in d
        people = [p for p in d["people"] if p["name"] == self.person]
        assert people and people[0]["balance"] == 1000

    def test_add_invalid(self, s):
        r = s.post(f"{API}/udhaar", json={"person": "", "amount": 10, "kind": "lena"})
        assert r.status_code == 422

    def test_settle(self, s):
        r = s.post(f"{API}/udhaar/settle", json={"person": self.person})
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Verify now gone from unsettled list
        d = s.get(f"{API}/udhaar").json()
        assert all(p["name"] != self.person for p in d["people"])

    def test_delete(self, s):
        if not TestUdhaar.uid:
            pytest.skip("no uid")
        r = s.delete(f"{API}/udhaar/{TestUdhaar.uid}")
        assert r.status_code == 200


# ---------- Bills ----------
class TestBills:
    bid = None

    def test_add_bill(self, s):
        r = s.post(f"{API}/bills", json={
            "name": "TEST_Electricity", "amount": 2500, "due_day": 15, "kind": "electricity"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_Electricity"
        assert d["paid_this_month"] is False
        TestBills.bid = d["id"]

    def test_list_bills(self, s):
        r = s.get(f"{API}/bills")
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert TestBills.bid in ids

    def test_pay_bill_idempotent(self, s):
        r1 = s.post(f"{API}/bills/{TestBills.bid}/pay")
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["paid_this_month"] is True
        # Count current bills expenses this month before second pay
        ym = datetime.utcnow().strftime("%Y-%m")
        before = s.get(f"{API}/expenses?month={ym}").json()
        bills_before = [e for e in before if e.get("category") == "bills" and "TEST_Electricity" in (e.get("note") or "")]
        # Second pay -- idempotent, no new expense
        r2 = s.post(f"{API}/bills/{TestBills.bid}/pay")
        assert r2.status_code == 200
        after = s.get(f"{API}/expenses?month={ym}").json()
        bills_after = [e for e in after if e.get("category") == "bills" and "TEST_Electricity" in (e.get("note") or "")]
        assert len(bills_after) == len(bills_before)

    def test_pay_bill_missing(self, s):
        r = s.post(f"{API}/bills/000000000000000000000000/pay")
        assert r.status_code == 404

    def test_delete_bill(self, s):
        if not TestBills.bid:
            pytest.skip("no bid")
        r = s.delete(f"{API}/bills/{TestBills.bid}")
        assert r.status_code == 200
        # cleanup the bills expense created
        ym = datetime.utcnow().strftime("%Y-%m")
        for e in s.get(f"{API}/expenses?month={ym}").json():
            if "TEST_Electricity" in (e.get("note") or ""):
                s.delete(f"{API}/expenses/{e['id']}")


# ---------- Summary & Report ----------
class TestSummary:
    def test_summary_shape(self, s):
        r = s.get(f"{API}/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("monthly_budget","month_spent","today_spent","daily_limit",
                  "today_left","days_left","unpaid_bills_total","recent","upcoming_bills"):
            assert k in d
        assert isinstance(d["recent"], list)
        assert isinstance(d["upcoming_bills"], list)

    def test_report_default_month(self, s):
        r = s.get(f"{API}/report")
        assert r.status_code == 200
        d = r.json()
        for k in ("month","total","count","budget","by_category","by_method","by_member"):
            assert k in d

    def test_report_specific_month(self, s):
        r = s.get(f"{API}/report?month=2024-01")
        assert r.status_code == 200
        assert r.json()["month"] == "2024-01"
