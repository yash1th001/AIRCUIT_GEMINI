# 📝 Resume Analyzer - AI-Powered Resume Analysis

A comprehensive resume analysis tool powered by AI that helps job seekers optimize their resumes for Applicant Tracking Systems (ATS) and job descriptions.

![Resume Analyzer](https://img.shields.io/badge/FastAPI-0.110.1-green) ![React](https://img.shields.io/badge/React-18.3.1-blue) ![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-green) ![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash%20Lite-orange)

## ✨ Features

### 🎯 Dual Analysis Modes

**Normal Review** (TF-IDF Based)
- Fast, local analysis using keyword matching
- No API key required
- Instant results
- Privacy-focused

**AI Review** (Gemini 2.5 Flash Lite Powered)
- **Advanced AI Analysis**: Uses the latest `gemini-2.5-flash-lite` model for high-quality insights.
- **Free Tier Optimized**: Smart pipeline optimization reduces API calls (single call for full analysis), making it perfect for free tier usage.
- **Personalized Feedback**: Detailed suggestions, strong matches, and critical gaps.
- **Flexible Keys**: Works with Emergent universal key OR your own personal Gemini API key.

### 📊 Comprehensive Scoring
- **ATS Score** (0-100)
- **Structure Score** (0-100)
- **JD Match Score** (0-100)

### 💡 Intelligent Suggestions
- Specific additions and removals
- Priority actions for maximum impact
- Candidate context extraction

### 🎨 Beautiful UI
- Modern React + Tailwind CSS interface
- Dark/Light mode support
- Smooth animations (shadcn/ui)

---

## 🚀 Get Started

Follow these steps to set up the project locally.

### 📋 Prerequisites
- **Node.js** (v18+)
- **Python** (v3.11+)
- **MongoDB** (v5.0+)
- **Yarn**

### 1. Installation

Clone the repository:
```bash
git clone <your-repo-url>
cd resume-analyzer
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/

# Create .env file
# (See .env.example if available, or use the configuration below)
```

**Backend `.env` Configuration:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=resume_analyzer_db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EMERGENT_LLM_KEY=sk-emergent-0984aD5617aB265E3A
# Optional: GEMINI_API_KEY=your_gemini_key_here
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
yarn install

# Create .env file
```

**Frontend `.env` Configuration:**
```env
VITE_SUPABASE_PROJECT_ID=hcxcoxipjhzfupchssyf
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeGNveGlwamh6ZnVwY2hzc3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwOTg1ODQsImV4cCI6MjA4MjY3NDU4NH0.APrd8JVPuoeSm99RB1AdILRpFwMNDAZcaYySPKTQSIc
VITE_SUPABASE_URL=https://hcxcoxipjhzfupchssyf.supabase.co
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 4. Run Application

**Start Backend:**
```bash
cd backend
uvicorn server:app --reload --port 8001
```

**Start Frontend:**
```bash
cd frontend
yarn dev
```

Visit **http://localhost:3000** to use the app!

---

## 🛠️ Technology Stack

### Backend
- **FastAPI** & **Uvicorn**
- **MongoDB** & **Motor** (Async)
- **Google Gemini 2.5 Flash Lite** (via `google-generativeai`)
- **Emergent Integrations**

### Frontend
- **React 18** & **Vite**
- **TypeScript**
- **Tailwind CSS** & **shadcn/ui**
- **Supabase** (Auth & DB)

## 📁 Project Structure

```
resume-analyzer/
├── backend/
│   ├── server.py              # Main application logic
│   └── requirements.txt       # Python deps
├── frontend/
│   ├── src/                   # React source
│   └── package.json           # Node deps
├── SETUP.md                   # Advanced troubleshooting
└── README.md                  # This file
```

## 🔑 API Keys

The app comes with a shared **Emergent Universal Key** pre-configured. It works out of the box!
If you prefer to use your own **Google Gemini API Key**:
1. Get a key from [Google AI Studio](https://makersuite.google.com/app/apikey).
2. Enter it in the App Settings OR add `GEMINI_API_KEY` to your backend `.env`.

## 🤝 Contributing

PRs are welcome! Please follow the code style (PEP 8 for Python, ESLint for JS/TS).

## 📝 License

MIT License.
