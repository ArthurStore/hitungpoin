# GridPlay FF Edition

Platform manajemen turnamen Free Fire dengan OCR client-side, leaderboard otomatis, dan generator sertifikat.

## Fitur Utama

- **OCR Lokal (Tesseract.js)** - Proses screenshot scoreboard di browser tanpa API server
- **Canvas Cropping** - Pre-processing gambar scoreboard 16:9 Free Fire
- **Wizard Turnamen** - Fast Tour, One Day, Champions Rush (target poin + Booyah)
- **Leaderboard Live** - 6 theme (Classic, Detail, Dark, Dark Pro, Neon, Minimal) + export PNG
- **Sertifikat Otomatis** - Juara 1, 2, 3 dengan Canvas API
- **Analytics Dashboard** - Metrik users, turnamen, OCR scans, revenue + chart 14 hari

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose) dengan fallback in-memory |
| OCR | Tesseract.js v5 |
| Charts | Recharts |
| Export | html2canvas |

## Struktur Project

```
ff-tournament-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Database & environment
│   │   ├── controllers/     # Tournament & analytics logic
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Points calculation
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/      # Navbar, Sidebar, Modal, Button
│   │   ├── context/         # Tournament state
│   │   ├── utils/           # OCR, cropping, certs, scoring
│   │   └── views/           # Dashboard, Create, Match, Leaderboard, Cert
│   └── package.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (opsional, fallback in-memory otomatis jika tidak tersedia)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API berjalan di `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App berjalan di `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/analytics/dashboard` | Dashboard metrics |
| POST | `/api/analytics/ocr-scan` | Record OCR scan count |
| GET | `/api/tournaments` | List tournaments |
| POST | `/api/tournaments` | Create tournament |
| GET | `/api/tournaments/:id` | Get tournament detail |
| GET | `/api/tournaments/:id/leaderboard` | Get standings |
| POST | `/api/tournaments/:id/matches/results` | Submit match results |

## Scoring Rules

**Total Points = Placement Points + Kill Points + Booyah Bonus**

| Placement | Points |
|-----------|--------|
| 1 (Booyah) | 12 + 5 bonus |
| 2 | 9 |
| 3 | 8 |
| 4-10 | 7-1 |
| 11-12 | 0 |

Kill Points: 1 poin per kill (default)

## Champions Rush

Turnamen berakhir ketika tim mencapai target poin (default 80) **dan** meraih Booyah.

## OCR Workflow

1. Upload 1-2 screenshot scoreboard (drag & drop)
2. Canvas auto-crop area scoreboard 16:9
3. Tesseract.js scan teks (Rank, Team, Kills)
4. Verifikasi & koreksi manual di tabel
5. Apply ke database

## License

MIT
