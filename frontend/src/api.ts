import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";
import { getLang } from "@/src/i18n";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

let token: string | null = null;
let onUnauthorized: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type User = { user_id: string; email: string; name: string; picture: string; household_id: string | null };
export type Expense = {
  id: string; amount: number; category: string; note: string; payment_method: string; member: string; added_by?: string; date: string;
  spend_level?: "normal" | "slightly_high" | "unusual" | null; need_type?: "need" | "want" | null;
};
export type ExpenseInput = { amount: number; category: string; note: string; payment_method: string; member: string };
export type Bill = { id: string; name: string; amount: number; due_day: number; kind: string; paid_this_month: boolean; days_left: number };
export type Summary = {
  household_name: string; monthly_budget: number; month_spent: number; today_spent: number; daily_limit: number; today_left: number;
  days_left: number; unpaid_bills_total: number; recent: Expense[]; upcoming_bills: Bill[];
};
export type UdhaarEntry = { id: string; person: string; amount: number; kind: "lena" | "dena"; note: string; date: string };
export type UdhaarPerson = { name: string; balance: number; entries: UdhaarEntry[] };
export type Udhaar = { total_lena: number; total_dena: number; people: UdhaarPerson[] };
export type Group = { key: string; amount: number };
export type Report = {
  month: string; total: number; count: number; budget: number; household_name: string;
  by_category: Group[]; by_method: Group[]; by_member: Group[]; by_need: Group[];
};
export type Settings = { name: string; monthly_budget: number; members: string[]; invite_code: string };
export type HouseholdInfo = Settings & { id: string; users: { name: string; email: string; picture: string }[] };
export type Parsed = { amount: number; category: string; note: string; payment_method: string; member: string; is_spend: boolean; sms_kind: string | null };

async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    throw new ApiError(res.status, typeof d === "string" ? d : "error");
  }
  return data as T;
}

export const api = {
  exchangeSession: (session_id: string) => req<{ session_token: string; user: User }>("/auth/session", "POST", { session_id }),
  me: () => req<User>("/auth/me"),
  logout: () => req("/auth/logout", "POST"),
  createHousehold: (name: string) => req<HouseholdInfo>("/household", "POST", { name }),
  joinHousehold: (code: string) => req<HouseholdInfo>("/household/join", "POST", { code }),
  leaveHousehold: () => req("/household/leave", "POST"),
  household: () => req<HouseholdInfo>("/household"),
  summary: () => req<Summary>("/summary"),
  settings: () => req<Settings>("/settings"),
  saveSettings: (s: { name?: string; monthly_budget: number; members: string[] }) => req<Settings>("/settings", "PUT", s),
  expenses: (month: string) => req<Expense[]>(`/expenses?month=${month}`),
  addExpense: (e: ExpenseInput) => req<Expense>("/expenses", "POST", e),
  setNeed: (id: string, need_type: "need" | "want") => req<Expense>(`/expenses/${id}`, "PATCH", { need_type }),
  deleteExpense: (id: string) => req(`/expenses/${id}`, "DELETE"),
  parse: (text: string, source: "text" | "voice" | "sms") => req<Parsed>("/parse", "POST", { text, source, lang: getLang() }),
  receipt: (image_base64: string) => req<Parsed>("/receipt", "POST", { image_base64, lang: getLang() }),
  categorize: (note: string) => req<{ category: string | null; confidence: number }>("/categorize", "POST", { note }),
  udhaar: () => req<Udhaar>("/udhaar"),
  addUdhaar: (u: { person: string; amount: number; kind: "lena" | "dena"; note: string }) => req("/udhaar", "POST", u),
  settle: (person: string) => req("/udhaar/settle", "POST", { person }),
  deleteUdhaar: (id: string) => req(`/udhaar/${id}`, "DELETE"),
  bills: () => req<Bill[]>("/bills"),
  addBill: (b: { name: string; amount: number; due_day: number; kind: string }) => req<Bill>("/bills", "POST", b),
  payBill: (id: string) => req<Bill>(`/bills/${id}/pay`, "POST"),
  deleteBill: (id: string) => req(`/bills/${id}`, "DELETE"),
  report: (month: string) => req<Report>(`/report?month=${month}`),
  async transcribe(uri: string): Promise<string> {
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const form = new FormData();
    let res: Response;
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      form.append("audio", blob, "recording.webm");
      res = await fetch(`${BASE}/transcribe`, { method: "POST", body: form, headers });
    } else {
      form.append("audio", new File(uri) as unknown as Blob, "recording.m4a");
      res = (await expoFetch(`${BASE}/transcribe`, { method: "POST", body: form, headers })) as unknown as Response;
    }
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status, data.detail || "error");
    return data.text as string;
  },
};
