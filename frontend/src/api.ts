const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

import { storage } from "./utils/storage";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await storage.secureGet<string | null>("auth_token", null);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

export type Station = {
  id: string;
  name: string;
  type: "pc" | "console" | "table";
  hourly_rate: number;
  status: "available" | "occupied" | "maintenance";
  active_session_id?: string | null;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  emoji: string;
};

export type SessionItem = {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
};

export type Session = {
  id: string;
  station_id: string;
  station_name: string;
  station_type: string;
  hourly_rate: number;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time?: string | null;
  items: SessionItem[];
  status: "active" | "completed";
  time_cost: number;
  items_cost: number;
  total: number;
  duration_minutes: number;
  live?: boolean;
};

export type PaymentEntry = { name?: string | null; method: "cash" | "upi"; amount: number };

export type Bill = {
  id: string;
  kind: "session" | "pos";
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  time_cost: number;
  items_cost: number;
  total: number;
  duration_minutes: number;
  items: SessionItem[];
  created_at: string;
  payment_status: "paid" | "unpaid";
  payment_method?: string | null;
  payments: PaymentEntry[];
  paid_at?: string | null;
};

export type CloseOut = {
  date: string;
  start: string;
  end: string;
  cash_total: number;
  upi_total: number;
  collected: number;
  unpaid_total: number;
  total_billed: number;
  time_revenue: number;
  fnb_revenue: number;
  session_count: number;
  pos_count: number;
  unpaid_bills: {
    id: string;
    kind: "session" | "pos";
    title: string;
    total: number;
    customer_name?: string | null;
    customer_phone?: string | null;
    created_at: string;
  }[];
};

export type CustomerLookup = {
  visit_count: number;
  last_name: string | null;
  last_visit_at: string | null;
  total_spent: number;
};

export type Analytics = {
  range_type: string;
  start: string;
  end: string;
  total_revenue: number;
  time_revenue: number;
  fnb_revenue: number;
  session_count: number;
  pos_count: number;
  total_minutes: number;
  labels: string[];
  time_series: number[];
  fnb_series: number[];
};

export const api = {
  // Auth
  register: async (name: string, email: string, password: string) => {
    const r = await req<{ access_token: string; token_type: string; user: any }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ name, email, password }) },
    );
    await storage.secureSet("auth_token", r.access_token);
    return r;
  },
  login: async (email: string, password: string) => {
    const r = await req<{ access_token: string; token_type: string; user: any }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    await storage.secureSet("auth_token", r.access_token);
    return r;
  },
  logout: async () => {
    await storage.secureRemove("auth_token");
  },
  // Stations
  listStations: () => req<Station[]>("/stations"),
  createStation: (data: Omit<Station, "id" | "status" | "active_session_id">) =>
    req<Station>("/stations", { method: "POST", body: JSON.stringify(data) }),
  updateStation: (id: string, data: Partial<Station>) =>
    req<Station>(`/stations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStation: (id: string) => req<{ ok: boolean }>(`/stations/${id}`, { method: "DELETE" }),

  // Menu
  listMenu: () => req<MenuItem[]>("/menu-items"),
  createMenu: (data: Omit<MenuItem, "id">) =>
    req<MenuItem>("/menu-items", { method: "POST", body: JSON.stringify(data) }),
  updateMenu: (id: string, data: Partial<Omit<MenuItem, "id">>) =>
    req<MenuItem>(`/menu-items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMenu: (id: string) => req(`/menu-items/${id}`, { method: "DELETE" }),

  // Sessions
  startSession: (data: { station_id: string; customer_name?: string; customer_phone?: string }) =>
    req<Session>("/sessions/start", { method: "POST", body: JSON.stringify(data) }),
  getSession: (id: string) => req<Session>(`/sessions/${id}`),
  addItems: (id: string, items: SessionItem[]) =>
    req<Session>(`/sessions/${id}/add-items`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  removeItem: (id: string, menu_item_id: string) =>
    req<Session>(`/sessions/${id}/remove-item`, {
      method: "POST",
      body: JSON.stringify({ menu_item_id }),
    }),
  endSession: (id: string) => req<Session>(`/sessions/${id}/end`, { method: "POST" }),
  updateSessionCustomer: (id: string, data: { customer_name: string; customer_phone: string }) =>
    req<Session>(`/sessions/${id}/customer`, { method: "PATCH", body: JSON.stringify(data) }),
  activeSessions: () => req<Session[]>("/sessions/active"),

  // POS
  createPOS: (data: { items: SessionItem[]; customer_name?: string; customer_phone?: string }) =>
    req<{ id: string; total: number; items: SessionItem[]; created_at: string }>(
      "/pos/orders",
      { method: "POST", body: JSON.stringify(data) },
    ),
  updatePOSCustomer: (id: string, data: { customer_name: string; customer_phone: string }) =>
    req<{ id: string; total: number; items: SessionItem[]; created_at: string }>(
      `/pos/orders/${id}/customer`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),

  // Bills
  listBills: (unpaidOnly?: boolean) =>
    req<Bill[]>(`/bills${unpaidOnly ? "?unpaid_only=true" : ""}`),
  payBill: (
    kind: "session" | "pos",
    id: string,
    method: "cash" | "upi" | "split",
    payments?: PaymentEntry[],
  ) =>
    req<{ ok: boolean } & Partial<Bill>>(`/bills/${kind}/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ method, payments }),
    }),
  customerLookup: (phone: string) =>
    req<CustomerLookup>(`/customers/lookup?phone=${encodeURIComponent(phone)}`),

  // Manager
  verifyPin: (pin: string) => req<{ ok: boolean }>("/manager/verify-pin", { method: "POST", body: JSON.stringify({ pin }) }),
  changePin: (current_pin: string, new_pin: string) =>
    req<{ ok: boolean }>("/manager/change-pin", {
      method: "POST",
      body: JSON.stringify({ current_pin, new_pin }),
    }),

  // Analytics
  analytics: (range_type: "daily" | "monthly", date?: string) =>
    req<Analytics>(`/analytics/summary?range_type=${range_type}${date ? `&date=${date}` : ""}`),
  closeOut: (date?: string) =>
    req<CloseOut>(`/reports/close-out${date ? `?date=${date}` : ""}`),
};

export const money = (n: number) => `₹${(n ?? 0).toFixed(2)}`;
