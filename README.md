# ⚡ Tracky — The Cyber-Dark Meal & Subscription Tracker

Welcome to **Tracky**! If you run a tiffin service, meal prep startup, or any subscription-based business, Tracky is built for you. We designed it with a clean, cyber-dark theme, high-contrast monospace stats, and premium animations. 

Unlike generic trackers, Tracky allows you to change the naming (Entity Translation) so you can track **Meals**, **Milk Delivery**, **Gym memberships**, or anything else!

---

## 🚀 Key Features

*   **Cyber-Dark UI/UX**: Sleek dark mode with glassmorphic cards and micro-animations.
*   **Flexible Subscriptions**: Custom plan types (Weekly, Monthly, Custom) and durations.
*   **Dynamic Labels**: Easily rename "Meals" to "Tiffin", "Milk", "Sessions" or whatever you deliver.
*   **Daily Checklist**: Fast check-in log (`delivered`, `skipped`, or `extra`) for all subscribers in one place.
*   **Payments Ledger**: Keep track of amount paid, pending balance, and billing status (`Paid`, `Partial`, `Unpaid`).
*   **Real-time Stats**: Track active customers, pending payments, collected revenue, and expenses this month.
*   **Hardened Security**: Features real Google Sign-in, API Rate Limiting, and secure Helmet HTTP headers.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19 (built with Vite), Tailwind CSS v4, Lucide React Icons.
*   **Backend**: Node.js + Express REST API.
*   **Database**: SQLite via `better-sqlite3` (lightweight, zero-config, file-backed).
*   **Auth**: Real Google OAuth 2.0 & standard email credentials.

---

## 💻 Getting Started Locally

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18 or higher recommended).

### 2. Setup Google Sign-In
To use Google Authentication:
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **Tracky**.
3. Go to **APIs & Services** > **OAuth Consent Screen**. Select **External** and fill in your App Name and support email.
4. Go to **APIs & Services** > **Credentials**. Click **+ Create Credentials** > **OAuth Client ID**.
5. Set Application Type to **Web Application**.
6. Under **Authorized JavaScript Origins**, add:
   `http://localhost:5173`
7. Copy the generated **Client ID** and put it in your environment files:
   - In `backend/.env`: `GOOGLE_CLIENT_ID=your_client_id_here`
   - In `frontend/.env.local`: `VITE_GOOGLE_CLIENT_ID=your_client_id_here`

### 3. Run the Backend Server
```bash
cd backend
npm install
npm run start
```
The backend will run at `http://localhost:5001`. On first start, it automatically generates a local SQLite database file `tracky.db` and seeds it with default mock data so you can play around right away!

### 4. Run the Frontend Development Server
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🛡️ Production & Security Enhancements

We've taken care of security best practices so you can deploy with confidence:
1.  **Helmet Integration**: Standard HTTP headers are set to protect the backend from common exploits (like XSS and clickjacking).
2.  **Rate Limiting**: Limits requests from a single IP to prevent brute-force attacks on the auth endpoints and scraping.
3.  **Secure CORS**: Configured to restrict requests in production via the `ALLOWED_ORIGIN` environment variable.

---

## 🌍 Deploying to Production

### 1. Deploy the Backend (e.g., Render, Railway, or VPS)
You can deploy the backend code to platforms like Render or Railway:
*   Make sure to configure the environment variables:
    *   `PORT` (usually provided automatically by host)
    *   `GOOGLE_CLIENT_ID` (your production Google OAuth Client ID)
    *   `ALLOWED_ORIGIN` (set this to your production frontend URL, e.g., `https://yourdomain.com` or `https://tracky.netlify.app`)
*   **SQLite Database**: Note that SQLite is a file-based database. If deploying to Render, use a **Persistent Disk** or deploy to a VPS so your database (`tracky.db`) is not wiped out when the server restarts.

### 2. Deploy the Frontend (Netlify, Vercel, or GoDaddy)
*   **Vite Build**: Generate static files by running:
    ```bash
    cd frontend
    npm run build
    ```
    This outputs the built app to the `dist/` directory.
*   **Environment Variable**: On Netlify or Vercel, define `VITE_API_URL` pointing to your hosted backend (e.g., `https://your-backend.onrender.com/api`).
*   **Hosting**: Upload the contents of the `dist/` directory directly to Netlify/Vercel, or configure GitHub integration for auto-deployment.
*   **Google Cloud Update**: Don't forget to go back to your Google Cloud Console and add your production URL (e.g., `https://your-app.netlify.app` or `https://www.yourdomain.com`) to the **Authorized JavaScript Origins** under your OAuth credentials!

---

Made with ❤️ by your development team. Happy tracking!
