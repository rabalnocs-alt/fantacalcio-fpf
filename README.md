# Fantacalcio FPF - BundeSalassa

App per aste del fantacalcio con sistema FPF (Financial Fair Play).

## Sviluppo locale

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deploy

### Backend → Render.com
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: vedi `backend/.env.example`

### Frontend → Netlify
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`
- Environment Variables: vedi `frontend/.env.production`
