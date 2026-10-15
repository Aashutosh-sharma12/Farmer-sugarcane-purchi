# Sugarcane Purchi Store

Farmers photograph or upload their mill purchi (slip). The backend reads every key-value on the slip with the Gemini API, stores it in MongoDB Atlas, and blocks duplicates (same image hash or same purchi number).

## Backend
```
cd backend
cp .env.example .env     # fill MONGO_URI (Atlas), JWT_SECRET, GEMINI_API_KEY, CLOUDINARY_URL (optional in dev)
npm install
npm run dev              # http://localhost:4000
```
- Atlas: Network Access must allow your IP. The URI needs a database name (e.g. `/purchi`).
- Gemini key (free): https://aistudio.google.com/apikey

## App
```
cd app
npm install
npx expo start           # scan QR with Expo Go (phone on same Wi-Fi as the computer)
```
The app finds the backend using the computer's IP automatically. To override, set `expo.extra.apiUrl` in `app/app.json`.

## Website (same code as the app)
```
cd app
npx expo start --web             # develop: opens http://localhost:8081
npx expo export --platform web   # build the static site into app/dist
```
Upload `app/dist` to any static host (Netlify, Vercel, Cloudflare Pages, Render static site). Before building, set `expo.extra.apiUrl` in `app/app.json` to your public backend URL (https). The browser version uses the gallery/file picker for photos (phone browsers also offer the camera).

## API
- POST /api/auth/register, /api/auth/login
- POST /api/purchi/extract (multipart `image`): duplicate check + extraction, nothing saved
- POST /api/purchi: save reviewed data
- GET /api/purchi?q=, GET /api/purchi/:id, DELETE /api/purchi/:id
# Farmer-sugarcane-purchi
