# گھر کھاتہ (Ghar Khata) — PRD

## Original problem statement
Urdu-first (Nastaliq) household expense tracker for Pakistani families with a "سمجھدار مددگار". Users: joint families, household budget manager (often mother/wife). Cash, JazzCash, Easypaisa, bank SMS, udhaar, monthly bills. Warm, respectful tone, no tech jargon. Requested 8–10 features, how it works, MVP (≤5), benefits, names, slogan.

## Concept (اردو)
- تعارف: گھر کا ہر خرچ بول کر لکھیں، اور مہینے کے آخر تک سکون سے گھر چلائیں۔
- صارفین: گھر کا بجٹ سنبھالنے والی ماں/بیوی، مشترکہ خاندان کے افراد۔
- خصوصیات: آواز سے خرچ، ایس ایم ایس سے خرچ، رسید کی تصویر، مشترکہ کھاتہ، ادھار، بل یاد دہانی، روزانہ حد، ماہانہ رپورٹ، بچت کے گلک، واٹس ایپ مددگار۔
- نام: گھر کھاتہ، حساب جی، برکت، گھر کا منشی
- نعرہ: «تھوڑا حساب، پورا سکون»

## User choices
MVP: expense entry + voice + udhaar + bill reminders + daily limit & monthly report. Defaults: gpt-4o-mini-transcribe (ur) + GPT-5.2 via Emergent LLM key, SMS paste (no auto-read in Expo Go), no login, single household with members.

## Architecture
- FastAPI + MongoDB (`settings`, `expenses`, `udhaar`, `bills`), PK timezone.
- Endpoints: /api/settings, /api/expenses, /api/parse, /api/transcribe, /api/udhaar(+settle), /api/bills(+pay), /api/summary, /api/report
- Expo Router: tabs (گھر، ادھار، بل، رپورٹ; NativeTabs on iOS 26+), modals add-expense, add-udhaar, add-bill, settings. Noto Nastaliq Urdu font, RTL layouts.

## Implemented (2026-06)
- All MVP features above; testing agent 28/28 backend pass, frontend flows pass.

## Jev decisions (2026-06)
- /api/categorize: note → category (auto-picks chip unless user chose one)
- /api/parse source=sms: Jev checks spend vs received/OTP/balance/promo before GPT parsing
- /api/expenses: spend_level (normal/slightly_high/unusual) → gentle toast; bill pay skips check
- Graceful fallback when Jev fails. Tested 19/19 backend + frontend flows.

## Iteration 3 (2026-06)
- Emergent Google sign-in (auth.tsx, /api/auth/*), root gate: login → household setup → app
- Shared household: create (6-letter invite code) / join by code / leave; all data household-scoped; fresh start (old data not migrated)
- Receipt photo (camera/gallery, permission flow) → GPT-5.2 vision /api/receipt; photo not stored
- Needs vs wants: Jev labels each expense; tap pill on ExpenseRow to change; report split bar + month expense list
- English/Urdu toggle (LTR Nunito / RTL Nastaliq), 4 themes (Paper, Night, Mehndi, Rose)
- Virality: share invite code, invite-family banner, share report card (image on native), tell friends
- Tested: 22/22 backend; frontend pass after fixing auth bootstrap race (screens now wait for session check)

## Backlog
- P1: Needs vs wants split in report (Jev), Emergent Google sign-in (paused by user)
- P1: Receipt photo scan, savings goals (گلک), automatic SMS reading (native Android build)
- P1: Roman Urdu UI toggle, local push reminders for bills (on request)
- P2: WhatsApp bot, multi-device shared household with login, PDF/WhatsApp share of monthly report
