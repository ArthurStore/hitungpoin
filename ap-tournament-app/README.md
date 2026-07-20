# AP (Arthur Points)

Platform otomatis manajemen turnamen & scoring Free Fire Esports.

## Fitur

- **Auth** - Register/Login organizer, isolasi turnamen per user
- **OCR Dual Mode** - CR Biasa (full scoreboard) & CR League (Ranklist Langsung Jeder)
- **Real-time Scan Logs** - Progress bar + terminal log box + 15s timeout + manual fallback
- **Tournament Hub** - Setup / Teams / Input Match / Leaderboard / Certificate per turnamen
- **Public Live** - `/live/:tournamentId` read-only standings
- **Super Admin** - `/admin` dengan PIN `1234`

## Quick Start

```powershell
# Backend (port 5001)
cd ap-tournament-app/backend
npm install
npm run dev

# Frontend (port 5174)
cd ap-tournament-app/frontend
npm install
npm run dev
```

Demo login: `demo@ap.local` / `demo1234`

## User Flow

```
Login -> Dashboard (My Tournaments) -> Tournament Hub -> Tabs
```

Public: `http://localhost:5174/live/{tournamentId}`

## OCR Modes

| Mode | Layout | Flow |
|------|--------|------|
| CR Biasa | Full end-game scoreboard | Rank, Team, Kills, rep verification |
| CR League | RANKLIST summary | Rank \| Team \| Score - langsung ke leaderboard |

## Tech Stack

React 19 + Vite + Tailwind v4 | Express + JWT | Tesseract.js | html2canvas | Recharts
