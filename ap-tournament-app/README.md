# AP (Arthur Points)

Platform otomatis manajemen turnamen & scoring Free Fire Esports.

## Features

- **Tournament Hub** - Setup, Teams, Input Match, Leaderboard, Certificate per turnamen
- **Dual OCR Mode** - CR Biasa (full scoreboard) & CR League (Ranklist Langsung Jeder)
- **Real-time Scan Logs** - Progress bar, terminal logs, 15s timeout, manual fallback
- **Auth** - Register/Login organizer dengan isolasi turnamen per user
- **Public Live** - `/live/:tournamentId` read-only standings
- **Super Admin** - `/admin` dengan PIN `1234`

---

## Project Structure

```
ap-tournament-app/
├── backend/          # Express API (port 5001)
├── frontend/         # React + Vite (port 5174)
├── ecosystem.config.js
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
└── nginx.conf
```

---

## 1. Run Locally (Development)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:5001/api/health`

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5174`

Local dev uses Vite proxy (`/api` -> `localhost:5001`). No `VITE_API_BASE_URL` needed.

**Demo login:** `demo@ap.local` / `demo1234`

---

## 2. Run on VPS with PM2

### Step 1: Build frontend with VPS API URL

```bash
cd frontend
cp .env.production.example .env.production
# Edit .env.production - set your VPS IP:
# VITE_API_BASE_URL=http://YOUR_VPS_IP:5001/api
npm install
npm run build
```

### Step 2: Configure backend

```bash
cd backend
cp .env.example .env
# Edit .env:
# HOST=0.0.0.0
# PORT=5001
# CORS_ORIGINS=http://YOUR_VPS_IP:5174
npm install --omit=dev
```

### Step 3: Start with PM2

From project root:

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### PM2 Commands

```bash
pm2 status
pm2 logs ap-backend
pm2 logs ap-frontend
pm2 restart all
pm2 stop all
```

---

## 3. Run with Docker

```bash
# From project root
docker-compose up -d --build
```

- Frontend: `http://localhost:5174` (NGINX proxies `/api` to backend)
- Backend: `http://localhost:5001`

With MongoDB:

```bash
MONGODB_URI=mongodb://mongodb:27017/ap_tournament docker-compose --profile mongo up -d --build
```

Stop:

```bash
docker-compose down
```

---

## 4. Environment Variables

### Frontend (`frontend/.env.production`)

| Variable | Local | VPS |
|----------|-------|-----|
| `VITE_API_BASE_URL` | (empty, uses `/api` proxy) | `http://YOUR_IP:5001/api` |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default: 5001) |
| `HOST` | Bind address (use `0.0.0.0` on VPS) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `JWT_SECRET` | JWT signing secret |
| `ADMIN_PIN` | Super admin PIN (default: 1234) |
| `MONGODB_URI` | Optional MongoDB URI (falls back to in-memory) |

---

## 5. Firewall & Port Setup

### UFW (Ubuntu VPS)

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 5001/tcp    # Backend API
sudo ufw allow 5174/tcp    # Frontend
sudo ufw enable
sudo ufw status
```

### Cloud Provider Security Groups

Open inbound rules for your VPS:

| Port | Protocol | Purpose |
|------|----------|---------|
| 5001 | TCP | Backend API |
| 5174 | TCP | Frontend UI |
| 80 | TCP | Optional (Docker NGINX) |
| 443 | TCP | Optional (HTTPS with reverse proxy) |

### Verify connectivity

```bash
curl http://YOUR_VPS_IP:5001/api/health
curl http://YOUR_VPS_IP:5174
```

---

## Troubleshooting

### "Save Setup" button stuck / no response

1. Check browser DevTools Network tab - API calls should go to port **5001**, not 5174
2. Set `VITE_API_BASE_URL=http://YOUR_VPS_IP:5001/api` and rebuild frontend
3. Ensure backend `CORS_ORIGINS` includes your frontend URL
4. Ensure backend listens on `0.0.0.0` not `127.0.0.1`

### CORS errors

Add frontend URL to backend `.env`:

```
CORS_ORIGINS=http://43.157.205.127:5174,http://localhost:5174
```

Restart backend after changes.

---

## Tech Stack

React 19 + Vite + Tailwind v4 | Express + JWT + bcrypt | Tesseract.js | html2canvas | Recharts | PM2 | Docker + NGINX
