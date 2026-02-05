# Project Documentation: Login & Resume Analysis Flow

This document provides a detailed technical analysis of the project's architecture, specifically focusing on the user authentication (login) flow and the core resume analysis functionality.

## 1. System Overview

The application is a **Resume Analysis Platform** that allows users to upload or paste a resume, optionally add a job description, and receive AI-powered feedback, ATS scoring, and improvement suggestions.

*   **Frontend**: React (Vite, TypeScript), TailwindCSS, Shadcn/UI.
*   **Backend**: Python (FastAPI, Uvicorn).
*   **Authentication/DB**: Supabase (Auth & Database).
*   **AI Engine**: Google Gemini (via `google-generativeai` Python SDK).

---

## 2. Authentication (Login) Flow

The login mechanism is significantly handled on the **Frontend** using **Supabase Authentication**. The Python backend does not handle user login sessions directly but expects a valid API key for the analysis feature (or uses the server's key).

### Flow Description

1.  **Entry Point**: The user lands on the main page (`/`).
    *   **File**: `frontend/src/pages/Index.tsx`
    *   **Logic**: Renders the `AnalyzerSection` component.

2.  **Auth Check (Frontend)**:
    *   **File**: `frontend/src/components/AnalyzerSection.tsx`
    *   **Function**: checks `const { user } = useAuth();`
    *   **Logic**:
        *   If `user` is **null**: It hides the analysis tools and renders the `<LoginPrompt />` component.
        *   If `user` **exists**: It renders the full analysis UI (Upload/Paste Resume).

3.  **User Action - Login**:
    *   **File**: `frontend/src/components/LoginPrompt.tsx`
    *   **Action**: User clicks "Sign In to Continue".
    *   **Effect**: Opens `<AuthModal />` (`frontend/src/components/auth/AuthModal.tsx`).

4.  **Supabase Authenication**:
    *   **File**: `frontend/src/hooks/use-auth.tsx` (AuthProvider)
    *   **Function**: `signIn(email, password)`
    *   **Implementation**: Calls `supabase.auth.signInWithPassword({ email, password })`.
    *   **Result**: If successful, Supabase returns a session. The `onAuthStateChange` listener in `AuthProvider` updates the global `user` state.

5.  **Post-Login**:
    *   The `AnalyzerSection` detects the `user` state change and re-renders to show the **File Upload** and **Text Input** fields.

---

## 3. Resume Analysis Flow

This is the core feature where the Frontend communicates with the Python Backend.

### Flow Description

1.  **User Input**:
    *   **File**: `frontend/src/components/AnalyzerSection.tsx`
    *   **State**: User provides `resumeText` (typed or parsed from PDF via `extractTextFromPDF` in `frontend/src/lib/pdfParser.ts`) and optionally `jobDescription`.

2.  **Trigger**:
    *   **File**: `frontend/src/components/AnalyzerSection.tsx`
    *   **Function**: `handleAnalyze()`
    *   **Action**: User clicks "Analyze Resume" (or "AI Analyze").
    *   **Mode Check**:
        *   If `analysisMode === "normal"`: Calls `analyzeResumeLocally()` (client-side TF-IDF).
        *   If `analysisMode === "ai"`: Initiates Backend API Call.

3.  **Backend Request (AI Mode)**:
    *   **Endpoint**: `POST /api/analyze-resume`
    *   **Payload**:
        ```json
        {
          "resumeText": "...",
          "jobDescription": "...",
          "geminiApiKey": "..." // Optional, if user provided their own key
        }
        ```

4.  **Backend Processing**:
    *   **File**: `backend/server.py`
    *   **Function**: `analyze_resume(request: ResumeAnalysisRequest)`
    *   **Step 1: Validation**: Checks if resume text exists and is within length limits (50k chars).
    *   **Step 2: Key Selection**: Uses the user-provided key OR the server's `GEMINI_API_KEY` from `.env`.
    *   **Step 3: Pipeline Execution**: Calls `run_analysis_pipeline()`.

5.  **AI Analysis (Internal)**:
    *   **File**: `backend/server.py`
    *   **Functions**: `analyze_with_job_description` OR `analyze_without_job_description`.
    *   **Model**: Uses `gemini-2.5-flash-lite` (via `get_model()`).
    *   **Prompt**: Constructs a complex prompt instructing the AI to act as an ATS analyst and return strict JSON including scores, key findings, and suggestions.
    *   **Response Parsing**: Calls `parse_json_response()` to extract valid JSON from the AI's markdown response.

6.  **Response & Storage**:
    *   **Backend**: Returns the JSON result to the Frontend.
    *   **Frontend**: `handleAnalyze` receives the data.
    *   **Frontend**: Calls `saveAnalysisToHistory` to save the result into the Supabase `resume_analyses` table (Direct Frontend -> DB insert).
    *   **Frontend**: Displays results using `ResultsSection`, `TailoredResumeSection`, etc.

---

## 4. Key Functions and Files Summary

| Component | File Path | Function Name | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Auth** | `frontend/src/hooks/use-auth.tsx` | `AuthProvider` | Manages global user state and Supabase listeners. |
| **Frontend UI** | `frontend/src/components/AnalyzerSection.tsx` | `AnalyzerSection` | Main controller. Gates access based on auth. Handles API calls. |
| **Frontend UI** | `frontend/src/components/LoginPrompt.tsx` | `LoginPrompt` | Restricted UI shown to non-logged-in users. |
| **Backend API** | `backend/server.py` | `analyze_resume` | FastAPI endpoint receiving the analysis request. |
| **Backend Logic** | `backend/server.py` | `run_analysis_pipeline` | Orchestrates the AI analysis (single call optimization). |
| **Backend AI** | `backend/server.py` | `analyze_with_job_description` | Constructs the Gemini prompt for combined Resume + JD analysis. |
| **Backend Util** | `backend/server.py` | `parse_json_response` | Cleans and parses the AI's string response into a Python Dict. |
