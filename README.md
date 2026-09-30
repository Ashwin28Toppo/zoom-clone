# Zoom Clone — Video Conferencing Web Application

A Zoom-like Video Conferencing Web Application built with Next.js (App Router, TypeScript), Python FastAPI, SQLite, and SQLAlchemy.

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, React 19)
- **Backend**: Python 3.12+ FastAPI, Uvicorn, Pydantic v2
- **Database**: SQLite with SQLAlchemy 2.0 ORM
- **Communication**: REST APIs
- **Media**: Browser MediaDevices API (camera & microphone preview/control)

---

## Project Structure

```
Zoom-Clone/
├── backend/
│   ├── .venv/                     # Dedicated Python virtual environment (ignored)
│   ├── app/
│   │   ├── routes/
│   │   │   └── meetings.py        # Meeting REST endpoints
│   │   ├── services/
│   │   │   └── meeting_service.py # Core business logic
│   │   ├── database.py            # SQLite connection & sessionmaker
│   │   ├── models.py              # SQLAlchemy ORM models (Meeting, Participant)
│   │   ├── schemas.py             # Pydantic schemas (requests & responses)
│   │   ├── seed.py                # Initial database seed script
│   │   └── main.py                # FastAPI app initialization & CORS
│   ├── .env.example               # Backend environment template
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   └── app/                   # Next.js App Router
│   ├── .env.example               # Frontend environment template
│   ├── .env.local                 # Local frontend environment config
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
└── README.md
```

---

## Local Setup Instructions (Windows PowerShell)

Follow these exact Windows PowerShell commands to set up and run the application from a fresh clone.

### 1. Clone & Enter Project Directory
```powershell
git clone <repository-url>
cd Zoom-Clone
```

### 2. Backend Setup

```powershell
# Navigate into backend directory
cd backend

# Create dedicated Python virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip (recommended)
python -m pip install --upgrade pip

# Install dependencies strictly inside .venv
pip install -r requirements.txt

# Start the FastAPI backend server (auto-creates tables and seeds SQLite database)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The FastAPI backend will be available at:
- **API Base URL**: `http://localhost:8000`
- **Interactive API Docs (Swagger UI)**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/health`

### 3. Frontend Setup

Open a **new Windows PowerShell window**:

```powershell
# Navigate into frontend directory
cd d:\Projects\Zoom-Clone\frontend

# Install Node.js dependencies
npm install

# Run Next.js development server
npm run dev
```

The frontend will be available at:
- **Dashboard**: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)
```ini
DATABASE_URL=sqlite:///./zoom_clone.db
CORS_ORIGINS=http://localhost:3000
HOST=0.0.0.0
PORT=8000
```

### Frontend (`frontend/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Routes Overview

- `/dashboard`: Zoom-style landing dashboard with instant action tiles, calendar, upcoming and recent meetings.
- `/meeting/schedule`: Dedicated Zoom meeting scheduling page with date, time, duration, timezone, and security options.
- `/meeting/[meetingId]/prejoin`: Pre-join screen with live camera preview, audio/video toggles, passcode, and name input.
- `/meeting/[meetingId]`: Zoom-like meeting room interface with active video tiles, meeting info, audio/video controls, participant panel, and end controls.
