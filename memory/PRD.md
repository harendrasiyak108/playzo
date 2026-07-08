# Playzo Gamezone Hub — PRD

Mobile-first (Expo / React Native) full-stack operations app for a gaming zone. Dark, neon-accented UI. INR currency. Backend: FastAPI + MongoDB.

## Tabs
1. **Stations** — 2-column live grid of all stations (PC / Console / Table) with status pills (Available / Occupied / Maintenance). Filter chips by type. Each card has an inline pencil to edit name / type / rate / status / delete. Tap available → Start Session. Tap occupied → Session Detail. `+` in header adds a new station.
2. **Active** — dedicated tab listing every running session with a live HH:MM:SS timer, hourly rate, live time cost, F&B running total, and grand running total. Tap opens Session Detail.
3. **POS** — walk-in food & drink cart. Category chips (Snacks / Meals / Drinks / …). Sticky cart bar with optional customer name/phone and Checkout. Header shortcut opens **Manage Menu**.
4. **Bills** — unified list of completed sessions and POS orders. Tap to view itemized receipt with **Share via WhatsApp / SMS** deep-links.
5. **Manager** — PIN-locked dashboard (default `1234`). Total revenue, Time vs F&B split, session/POS/play-time stat cards, stacked bar chart. Toggle Daily / Monthly. Change PIN modal from header.

## Manageable Data
- Stations: add / edit name, type, hourly rate, status / delete (only if not occupied).
- F&B Menu: full CRUD from Manage Menu modal (emoji, name, price, category).
- Manager PIN: change from Manager tab (4-8 digits).

## Backend (all under `/api`)
- `GET/POST /stations`, `PATCH/DELETE /stations/{id}`
- `GET/POST /menu-items`, `PATCH/DELETE /menu-items/{id}`
- `POST /sessions/start`, `GET /sessions/active`, `GET /sessions/{id}` (live), `POST /sessions/{id}/add-items`, `/remove-item`, `/end`
- `POST/GET /pos/orders`
- `GET /bills` (unified session + pos)
- `POST /manager/verify-pin`, `POST /manager/change-pin`
- `GET /analytics/summary?range_type=daily|monthly[&date=…]`

## Cost math
`time_cost = (duration_min / 60) × hourly_rate`. Frontend recomputes live every second; backend recomputes at end for the authoritative bill.
