# DG Repo — Corporate Document Management System

A Paperless-ngx inspired document management system built for corporate use.

## 🌐 Live URLs

| Platform | URL |
|----------|-----|
| **Vercel (Primary)** | https://dg-repo.vercel.app |
| **Firebase Hosting** | https://dg-repo-sohan.web.app |

## ✨ Features

- 📄 **Document Upload** with OCR text extraction
- 🔍 **Full-text Search** — search by invoice number, BIN, tags, OCR content
- 🏷️ **Flexible Tagging** — auto-tag + manual tags with color coding
- 📊 **Dashboard** with real-time storage stats
- 🔒 **Firebase Auth** — Google Sign-In + Email/Password
- ☁️ **Firebase Storage** — resumable uploads with progress bar
- 🗂️ **Document Types, Correspondents, Tags, Custom Fields**
- 🌑 **Dark mode** UI inspired by Paperless-ngx

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project

### Local Development

```bash
# Clone
git clone https://github.com/bluesun-gif/dg-repo.git
cd dg-repo

# Install
npm install

# Set up environment (copy and fill in your values)
cp .env.example .env

# Run locally
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase project config:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GEMINI_API_KEY=...
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel deploy --prod
```

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth**: Firebase Authentication
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage (resumable uploads)
- **Hosting**: Vercel + Firebase Hosting
- **OCR**: PDF.js + Tesseract.js

## 📁 Project Structure

```
src/
├── components/      # Shared UI components (GlobalSearch, DocCard, etc.)
├── contexts/        # Auth context
├── layouts/         # Root layout with sidebar nav
├── lib/             # Utilities (fileParser, gemini, utils)
├── pages/           # All page components
│   ├── Dashboard.tsx
│   ├── Upload.tsx
│   ├── DocumentsList.tsx
│   ├── DocumentDetail.tsx
│   └── ...
└── firebase.ts      # Firebase config
```
