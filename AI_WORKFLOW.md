# AIcruit Workflow & Logic Logic

This document details the scoring algorithms, AI analysis workflow, and the competitive advantages of AIcruit over traditional ATS systems.

## 1. Score Calculation Workflows

AIcruit uses two distinct modes for analysis: **Normal Mode (Local)** and **AI Mode (Gemini)**.

### A. Normal Mode (Local Analysis)
**Speed:** Instant (<100ms) | **Privacy:** Data stays in browser | **Method:** Statistical & Keyword Matching

1.  **ATS Score (0-100)**
    *   **Contact Info (15 pts):** Checks for email (`@`, `.` ) and phone patterns.
    *   **Sections (65 pts):** allocating points for key sections:
        *   Experience (15), Summary (10), Education (10), Skills (10)
        *   Action Verbs (15): Scans for strong verbs (e.g., "led", "developed").
        *   Quantifiable Metrics (5): Checks for numbers/percentages (e.g., "20%", "$50k").
    *   **Formatting (20 pts):** Evaluates use of bullet points and standard location formats.

2.  **JD Match Score (0-100)**
    *   **Algorithm:** **Term Frequency-Inverse Document Frequency (TF-IDF)**
    *   **Process:**
        1.  Tokenizes both Resume and Job Description (JD).
        2.  Calculates frequency of key terms in the JD (weighing unique/rare terms higher).
        3.  Measures how many of these weighted terms appear in the resume.
    *   **Result:** A percentage score representing statistical keyword overlap.

---

### B. AI Mode (Gemini 2.5 Analysis)
**Speed:** Fast (~2-4s) | **Depth:** Semantic Understanding | **Method:** Large Language Model (LLM) Reasoning

1.  **Complete Profile Analysis**
    *   The AI reads the **entire** resume text (~8k characters) and JD (~4k characters) simultaneously.
    *   It builds a holistic understanding of the candidate's career trajectory, not just keywords.

2.  **Gap Analysis & Reasoning (Step-by-Step)**
    *   **Step 1: Requirement Extraction:** The AI extracts hard vs. soft skills from the JD.
    *   **Step 2: Semantic Mapping:** It maps resume experience to JD requirements (e.g., mapping "React" experience to a "Frontend Framework" requirement, even if the exact words differ).
    *   **Step 3: Gap Identification:** It identifies missing critical skills or experience levels.
    *   **Step 4: Scoring:**
        *   **ATS Score:** Evaluates formatting, readability, and presence of standard ATS-friendly sections.
        *   **JD Match:** Assigns a score based on the *quality* and *relevance* of experience, not just keyword count.

## 2. Competitive Advantage: AIcruit vs. Traditional ATS

| Feature | Traditional ATS (Keyword Match) | AIcruit (Generative AI) |
| :--- | :--- | :--- |
| **Matching Logic** | **Exact Keyword Matching**<br>Only finds "Python" if you type "Python". Misses "Django" or "Flask" if not explicitly listed as keywords. | **Semantic Understanding**<br>Understands "Django developer" likely knows "Python". Connecting related concepts without exact matches. |
| **Scoring** | **Frequency Counting**<br>More keywords = Higher score. Encourages "keyword stuffing" (hiding words in white text). | **Contextual Evaluation**<br>Evaluates *how* skills were applied. "Used Python" vs. "Architected Python backend" get different weights. |
| **Feedback** | **Generic / None**<br>"You are missing 'Java'." | **Actionable Coaching**<br>"Your experience implies Java skills, but you didn't list it explicitly. Add 'Java' to your Skills section to pass initial screens." |
| **Bias** | **High**<br>Rejects candidates with non-standard titles or different terminology. | **Reduced**<br>Focuses on underlying skills and capabilities rather than specific job titles. |
| **Adaptability** | **Rigid**<br>Rules must be manually updated for every new technology. | **Dynamic**<br>Gemini is trained on vast datasets and understands new tech (e.g., "MCP servers") instantly without rule updates. |

## 3. Detailed AI Pipeline

1.  **Input Processing**: User uploads PDF -> Text extracted -> Cleaned & Truncated.
2.  **Prompt Engineering**: A highly optimized system prompt instructs Gemini to act as an "Expert ATS Analyst".
3.  **Single-Pass Analysis**:
    *   Instead of making multiple costly API calls, we use a complex single prompt to extract:
        *   Scores (ATS, Structure, Match)
        *   Candidate Context (Name, Role, Exp)
        *   Key Findings (Strong matches, Critical gaps)
        *   Section-by-section improvements
4.  **Structured Output**: The AI returns a strict JSON object, which the frontend visualizes as interactive charts and checklists.

## 4. Calculation Examples

To understand exactly how the system outputs a number, here are concrete examples.

### Example A: Normal Mode (Keyword Match)
**Scenario:**
*   **Job Description:** Requires "Python", "React", "AWS".
*   **Resume:** Mentions "Python", "Javascript", "Azure".

**Calculation:**
1.  **Total Weighted Tokens (JD):** Python (10) + React (10) + AWS (10) = **30** (Total Potential)
2.  **Matched Tokens (Resume):**
    *   "Python" found -> +10 points.
    *   "React" missing -> 0 points.
    *   "AWS" missing -> 0 points.
    *   *(Note: "Azure" is irrelevant because simple keyword matching doesn't know it's a cloud alternative).*
3.  **Final Score:** (10 / 30) * 100 = **33%**

### Example B: AI Mode (Semantic Understanding)
**Scenario:** Same as above.
*   **Job Description:** Requires "Python", "React", "AWS".
*   **Resume:** Mentions "Python", "Javascript", "Azure".

**AI Reasoning & Scoring:**
1.  **Direct Match:** "Python" found. (Score: +100% contribution for this skill).
2.  **Inferred Match:**
    *   **JD Requirement:** "AWS" (Cloud Skills).
    *   **Resume:** "Azure".
    *   **AI Reasoning:** "Candidate knows Cloud Computing via Azure. Skills are transferable."
    *   **Score:** Assigns **85%** partial credit instead of 0.
3.  **Contextual Gap:**
    *   **JD Requirement:** "React" (Frontend).
    *   **Resume:** "Javascript".
    *   **AI Reasoning:** "Candidate knows Javascript (Foundation) but lacks specific React framework experience."
    *   **Score:** Assigns **50%** partial credit.
4.  **Final Score Calculation:**
    *   (100 + 85 + 50) / 300 = **78%**

**Result:**
*   **Normal Mode Score:** 33% (Rejected)
*   **AI Mode Score:** 78% (Considered - Good Potential)
