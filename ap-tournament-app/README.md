# AP (Arthur Points)

Platform otomatis manajemen turnamen & scoring Free Fire Esports — OCR Gemini Vision, leaderboard live, OBS overlay 16:9, sertifikat, dan admin panel.

---

## Fitur Utama

- **Tournament Hub** — Setup, Teams (inline rename), Input Match OCR, Leaderboard, Certificate
- **Dual OCR Mode** — CR Biasa (scoreboard + 4 nick) & CR League (Nama Tim + Score, auto-create tim)
- **Smart Roster Memory** — Auto-match nick/nama tim antar match; roster hingga 6 player
- **Live OBS Overlay** — `/overlay/:slug` fullscreen 16:9, tema blue neon, Socket.io realtime
- **Inline Edit** — Edit skor match & rename nama tim langsung di Leaderboard / Teams
- **Auth Organizer** — Isolasi turnamen per user + Super Admin PIN

---

## Struktur Proyek

```
ap-tournament-app/
├── backend/                 # Express API (default port 5001)
│   ├── .env.example
│   ├── data/settings.json   # Persistensi Gemini keys (auto)
│   └── src/
├── frontend/                # React + Vite (default port 5174)
│   ├── .env.example
│   └── .env.production.example
├── ecosystem.config.js      # PM2
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── nginx.conf
```

---

## Step 1 — Clone & Environment Variables

```bash
git clone <URL_REPO> hitung-poin
cd hitung-poin/ap-tournament-app
```

### Backend `.env`

```bash
cd backend
cp .env.example .env
```

Isi minimal:

```env
PORT=5001
HOST=0.0.0.0
JWT_SECRET=ganti-dengan-secret-panjang
ADMIN_PIN=1234
NODE_ENV=production
CORS_ORIGINS=http://localhost:5174,https://domain-anda.com

# Opsional MongoDB (tanpa ini = in-memory store)
# MONGODB_URI=mongodb://localhost:27017/ap_tournament

# Gemini (bisa juga diisi lewat Admin Dashboard)
GEMINI_API_KEY=
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
```

### Frontend `.env` (dev)

```bash
cd frontend
cp .env.example .env
```

Local: biarkan `VITE_API_BASE_URL` kosong (Vite proxy `/api` → `localhost:5001`).

### Frontend production

```bash
cp .env.production.example .env.production
# VITE_API_BASE_URL=https://api.domain-anda.com/api
# atau http://IP_VPS:5001/api
```

---

## Step 2 — Konfigurasi GEMINI_API_KEY (Multi-Key)

Sistem mendukung **3 slot API key** dengan Round-Robin + fallback quota.

| Metode | Cara |
|--------|------|
| **Admin Dashboard** | Login → `/admin` → verifikasi PIN → isi Key 1–3 → Save. Key ditulis ke `backend/data/settings.json` **dan** `backend/.env` (survive `pm2 restart`). |
| **File `.env`** | Set `GEMINI_API_KEY` (primary) dan/atau `GEMINI_API_KEY_1..3`. Saat server start, key di-hydrate ke settings. |
| **settings.json** | Fallback persisten di `backend/data/settings.json`. |

Setelah ubah key via Admin, tidak wajib edit `.env` manual — backend sudah sync keduanya.

Test koneksi: tombol **Test Gemini** di Admin Panel.

---

## Step 3 — Admin Security (PIN & Credentials)

| Item | Default / Keterangan |
|------|----------------------|
| **Admin PIN** | `ADMIN_PIN` di `.env` (default contoh: `1234`) — **wajib diganti di production** |
| **Demo Organizer** | Email `demo@ap.local` / password `demo1234` (seed in-memory) |
| **JWT** | `JWT_SECRET` harus unik & kuat di VPS |

Akses Super Admin: buka `/admin`, masukkan PIN → kelola Gemini keys, analytics, cleanup.

---

## Step 4 — Deploy VPS Ubuntu (Node.js + PM2 / Docker)

### Opsi A — PM2 (disarankan sederhana)

```bash
# Node 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# Backend
cd /path/to/ap-tournament-app/backend
cp .env.example .env   # edit nilai production
npm install --omit=dev

# Frontend build
cd ../frontend
cp .env.production.example .env.production
# set VITE_API_BASE_URL
npm install
npm run build

# Start dari root project
cd ..
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

Firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 5001/tcp
sudo ufw allow 5174/tcp
# jika pakai Nginx:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Opsi B — Docker Compose

```bash
cd ap-tournament-app
# Sesuaikan env di docker-compose / .env
docker compose up -d --build
```

- Frontend + Nginx proxy: biasanya port `80` / `5174`
- Backend: `5001`
- Profile Mongo (opsional): lihat `docker-compose.yml`

```bash
docker compose down
docker compose logs -f
```

---

## Step 5 — Nginx Reverse Proxy & HTTPS

### Sub-path `/hitungpoin/` (produksi arthurg.my.id)

Logo/upload dilayani lewat **`/hitungpoin/api/uploads/`** (Express static).
Pastikan block API ada; opsional juga proxy `/hitungpoin/uploads/`.

```nginx
location /hitungpoin/api/ {
    proxy_pass http://127.0.0.1:5001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 50M;
}

# Opsional — jika ingin URL /hitungpoin/uploads/... langsung
location /hitungpoin/uploads/ {
    proxy_pass http://127.0.0.1:5001/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}

location /hitungpoin/ {
    alias /var/www/hitungpoin/frontend/dist/;
    try_files $uri $uri/ /hitungpoin/index.html;
}
```

### Root domain (tanpa sub-path)

```nginx
server {
    listen 80;
    server_name poin.example.com;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5001/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### SSL dengan Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d poin.example.com
```

### Cloudflare

1. DNS A record → IP VPS (Proxy orange cloud opsional)
2. SSL/TLS mode: **Full** (dengan Certbot) atau **Flexible** (hanya Cloudflare↔visitor)
3. Set `CORS_ORIGINS=https://poin.example.com`
4. Rebuild frontend dengan `VITE_API_BASE_URL=https://poin.example.com/api` (jika API same-origin via Nginx)

---

## Step 6 — Menjalankan & Restart Service

### PM2

```bash
pm2 status
pm2 logs ap-backend
pm2 logs ap-frontend
pm2 restart ap-backend
pm2 restart all
pm2 stop all
pm2 save
```

Setelah update kode:

```bash
cd frontend && npm run build
cd ../backend && npm install --omit=dev
pm2 restart all
```

### Docker

```bash
docker compose up -d --build
docker compose restart
docker compose logs -f backend
```

### Dev lokal

```bash
# Terminal 1
cd backend && npm install && npm run dev

# Terminal 2
cd frontend && npm install && npm run dev
```

- App: `http://localhost:5174`
- API health: `http://localhost:5001/api/health`
- OBS Overlay: `http://localhost:5174/overlay/<tournamentId-atau-slug>`
- Admin: `http://localhost:5174/admin`

---

## OBS Browser Source

1. Buat sumber **Browser** di OBS
2. URL: `http(s)://HOST/overlay/<tournamentId>` atau slug nama turnamen
3. Width **1920** × Height **1080**
4. Centang *Shutdown source when not visible* (opsional)
5. Refresh cache setelah deploy frontend baru

---

## Troubleshooting

| Gejala | Perbaikan |
|--------|-----------|
| OCR gagal / key hilang setelah PM2 restart | Isi key di Admin → Save (tulis `.env` + `settings.json`), lalu `pm2 restart ap-backend` |
| CORS error | Tambahkan origin frontend ke `CORS_ORIGINS`, restart backend |
| Frontend hit API salah port | Set `VITE_API_BASE_URL` lalu **rebuild** frontend |
| Overlay terpotong | Pastikan Browser Source 1920×1080; hard refresh URL overlay |
| Socket tidak live | Proxy `/socket.io/` dengan Upgrade headers (lihat Nginx di atas) |

---

## Tech Stack

React 19 · Vite · Tailwind CSS v4 · Express · Socket.io · Gemini Vision OCR · JWT · PM2 · Docker · Nginx
