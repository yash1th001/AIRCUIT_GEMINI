# 📝 Resume Analyzer - AI-Powered Resume Analysis

A comprehensive resume analysis tool powered by AI that helps job seekers optimize their resumes for Applicant Tracking Systems (ATS) and job descriptions.

![Resume Analyzer](https://img.shields.io/badge/FastAPI-0.110.1-green) ![React](https://img.shields.io/badge/React-18.3.1-blue) ![MongoDB](https://img.shields.io/badge/MongoDB-5.0+-green) ![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash%20Lite-orange)

## ✨ Features

### 🎯 Dual Analysis Modes

**1. Normal Review (Local Analysis)**
- Fast, local analysis using TF-IDF keyword matching.
- Evaluates resume structure and extracts ATS parsability scores.
- **Privacy-focused**: Processing happens entirely in your browser.
- **No API key required**, completely free.

**2. AI Review (Gemini-Powered)**
- **Advanced AI Analysis**: Uses the `gemini-2.5-flash-lite` model for deep semantic insights.
- **Personalized Feedback**: Detailed suggestions, JD semantic match scoring, and critical gaps identification.
- **Bias Auditing**: Includes a FAIRE-methodology bias audit feature testing the AI against name variants.
- **Requires your own Google Gemini API key** (securely saved locally in your browser).

### 📊 Comprehensive Scoring
- **ATS Score** (0-100)
- **Structure Score** (0-100)
- **JD Match Score** (0-100, based on semantic similarity and keyword presence)

### 💡 Intelligent Tools
- **Tailored Resume Generator**: Automatically applies AI suggestions and provides a clean PDF or TXT export of the improved resume.
- **Resume Chat**: Chat directly with your resume to ask questions, simulate interviews, or get specific phrasing advice.

---

## 🚀 Get Started

Follow these steps to set up the project locally.

### 📋 Prerequisites
- **Node.js** (v18+)
- **Python** (v3.11+)
- **MongoDB** (v5.0+) (Running locally or via Atlas)
- **Yarn** or **npm**

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

# Create .env file
```

**Backend `.env` Configuration:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=resume_analyzer_db
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
JWT_SECRET_KEY=your_secure_random_string_here
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
# or
yarn install

# Create .env file
```

**Frontend `.env` Configuration:**
```env
VITE_APP_BACKEND_URL=http://localhost:8001
```

### 4. Run Application

**Start Backend (FastAPI):**
```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

**Start Frontend (Vite):**
```bash
cd frontend
npm run dev
# or 
yarn dev
```

Visit the URL provided by Vite (usually **http://localhost:5173**) to use the app!

---

## 🔑 API Keys

To use the **AI Review** mode, you must provide your own Google Gemini API key.
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. When you click "AI Analyze" in the app, you will be prompted to enter your key.
3. Your key is stored securely in your browser's local storage and sent directly to the backend for analysis.

## 🛠️ Technology Stack

### Backend
- **FastAPI** & **Uvicorn**
- **MongoDB** & **Motor** (Async DB Driver)
- **Google Gemini SDK** (`google-generativeai`)
- **PyJWT** & **Passlib** (Custom Session Authentication)

### Frontend
- **React 18** & **Vite**
- **TypeScript**
- **Tailwind CSS** & **shadcn/ui**
- **Lucide React** (Icons)

## 📁 Project Structure

```
resume-analyzer/
├── backend/
│   ├── server.py              # Main FastAPI application logic & endpoints
│   └── requirements.txt       # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/        # React UI components (Analyzer, Results, Chat, etc.)
│   │   ├── lib/               # Utilities (Local analysis, PDF generation, API)
│   │   └── hooks/             # Custom React hooks (Auth, Profile)
│   ├── package.json           # Node dependencies
│   └── vite.config.ts         # Vite bundler config
└── README.md                  # This file
```

## 🤝 Contributing

PRs are welcome! Please follow standard code styles (PEP 8 for Python, ESLint/Prettier for React).

## 📝 License

MIT License.
