import { Platform } from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { File } from "expo-file-system";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export type Expense = {
  id: string;
  amount: number;
  category: string;
  note: string;
  payment_method: string;
  member: string;
  date: string;
};
export type ExpenseInput = Omit<Expense, "id" | "date">;
export type Bill = {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  kind: string;
  paid_this_month: boolean;
  days_left: number;
};
export type Summary = {
  monthly_budget: number;
  month_spent: number;
  today_spent: number;
  daily_limit: number;
  today_left: number;
  days_left: number;
  unpaid_bills_total: number;
  recent: Expense[];
  upcoming_bills: Bill[];
};
export type UdhaarEntry = { id: string; person: string; amount: number; kind: "lena" | "dena"; note: string; date: string };
export type UdhaarPerson = { name: string; balance: number; entries: UdhaarEntry[] };
export type Udhaar = { total_lena: number; total_dena: number; people: UdhaarPerson[] };
export type Group = { key: string; amount: number };
export type Report = { month: string; total: number; count: number; budget: number; by_category: Group[]; by_method: Group[]; by_member: Group[] };
export type Settings = { monthly_budget: number; members: string[] };
export type Parsed = { amount: number; category: string; note: string; payment_method: string; member: string };

async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    throw new Error(typeof d === "string" ? d : "کچھ مسئلہ ہو گیا، دوبارہ کوشش کریں");
  }
  return data as T;
}

export const api = {
  summary: () => req<Summary>("/summary"),
  settings: () => req<Settings>("/settings"),
  saveSettings: (s: Settings) => req<Settings>("/settings", "PUT", s),
  addExpense: (e: ExpenseInput) => req<Expense>("/expenses", "POST", e),
  deleteExpense: (id: string) => req(`/expenses/${id}`, "DELETE"),
  parse: (text: string) => req<Parsed>("/parse", "POST", { text }),
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
    let res: Response;
    if (Platform.OS === "web") {
      const blob = await (await fetch(uri)).blob();
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      res = await fetch(`${BASE}/transcribe`, { method: "POST", body: form });
    } else {
      const form = new FormData();
      form.append("audio", new File(uri) as unknown as Blob, "recording.m4a");
      res = (await expoFetch(`${BASE}/transcribe`, { method: "POST", body: form })) as unknown as Response;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "آواز سمجھ نہیں آئی");
    return data.text as string;
  },
};
