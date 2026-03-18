# AIcruit Workflow & Logic

This document details the scoring algorithms, AI analysis workflow, and the competitive advantages of AIcruit over traditional ATS systems.

## 1. Score Calculation Workflows

AIcruit uses two distinct modes for analysis: **Normal Mode (Local)** and **AI Mode (Gemini)**.

### A. Normal Mode (Local Analysis)
**Speed:** Instant (<100ms) | **Privacy:** Data stays in browser | **Method:** Statistical & Keyword Matching

1. **ATS Score (0-100)**
   * **Contact Info (15 pts):** Checks for email (`@`, `.` ) and phone patterns.
   * **Sections (65 pts):** Allocates points for key sections:
     * Experience (15), Summary (10), Education (10), Skills (10)
     * Action Verbs (15): Scans for strong verbs (e.g., "led", "developed").
     * Quantifiable Metrics (5): Checks for numbers/percentages (e.g., "20%", "$50k").
   * **Formatting (20 pts):** Evaluates use of bullet points and standard location formats.

2. **JD Match Score (0-100)**
   * **Algorithm:** Term Frequency (Simple Keyword Matching)
   * **Process:** Tokenizes Job Description into key terms, checking for presence in the resume.

---

### B. AI Mode (Gemini 2.5 Flash Lite)
**Speed:** Fast (~2-4s) | **Depth:** Semantic Understanding | **Method:** LLM Reasoning & NLP

The AI mode is a comprehensive pipeline designed for both deep analysis and research-grade evaluation. **Note: This mode requires the user to provide their own Google Gemini API key.**

#### Pipeline Steps:
1. **Validation & Configuration**: Validates input length (Max 50k chars for resume, 20k for JD) and configures the user's Gemini API key.
2. **PII Stripping**: Employs regex to mask emails and phone numbers (replacing with `[EMAIL]` and `[PHONE]`) to prevent PII-based hallucination or basic bias before reaching the LLM.
3. **Early Bias Detection**: Scans for high-risk demographic keywords (age, marital status, nationality, religion) and flags the analysis if found.
4. **Caching**: Computes a SHA-256 hash of the resume + JD. If an identical context was recently analyzed, it returns the cached result (Time: <50ms).
5. **Semantic Similarity (NLP)**: If a JD is provided, uses `sentence-transformers` (`all-MiniLM-L6-v2`) to compute a pure cosine similarity vector score between the resume and JD embeddings.
6. **Gemini Execution**: Sends the heavily structured system prompt and cleaned text to the `gemini-2.5-flash-lite` model.
7. **Audit Logging**: Asynchronously logs the analysis results, scores, and metadata to MongoDB for research and tracking.

#### AI Scoring Breakdown (XAI)
To provide Explainable AI (XAI), the model is forced to return a `scoreBreakdown` object. For every single point awarded across ATS, JD Match, and Structure, the AI must provide a `criterionName`, `scoreAwarded`, `maxPossible`, and a concise explanation (`evidence`) justifying the exact score.

---

## 2. Bias Auditing (FAIRE Methodology)

AIcruit implements a dedicated bias testing endpoint (`/api/audit-bias`) inspired by the FAIRE methodology to measure LLM scoring fairness.

**How it works:**
1. The user's original resume is stripped of PII.
2. The system forcefully prepends 4 different name variants representing different demographics (e.g., "Western Male", "South Asian Female").
3. The LLM evaluates all 4 modified resumes sequentially.
4. The system calculates the **Mean Score** and the **Max Variance**.
5. **Flagging**: If the ATS score varies by more than **5 points** across identical resumes with only different names, the system flags a potential LLM Bias warning.

---

## 3. Competitive Advantage: AIcruit Features & Their Impact

AIcruit is not just a UI wrapper over ChatGPT. It implements a fully engineered, research-grade pipeline designed to solve specific problems in AI recruitment.

| Feature | How It Works | Why It Matters (The Impact) |
| :--- | :--- | :--- |
| **Semantic Vector Matching** | Uses NLP (`all-MiniLM-L6-v2`) to compute mathematical similarity between the resume and JD *before* the LLM sees it. | **The Difference**: Traditional ATS relies on exact Ctrl+F keyword matches (missing "Django" if JD asks for "Python"). AIcruit understands the *meaning* of words, ensuring capable candidates aren't rejected due to synonymous vocabulary. |
| **XAI (Explainable AI) Breakdown** | Forces the LLM to return a strict JSON block detailing exactly *why* every single point was awarded/deducted. | **The Difference**: Most AI models are "Black Boxes" returning a single score (e.g., 75/100). AIcruit completely demystifies the scoring, providing clear, actionable evidence for every metric to build user trust. |
| **FAIRE Bias Auditing** | Automatically runs the resume through the AI multiple times, swapping the candidate's name across demographic profiles (e.g., Western vs. South Asian) to test if the score changes. | **The Difference**: AI naturally inherits human biases from its training data. By actively measuring the score variance across demographics, AIcruit guarantees transparent and equitable evaluations, moving beyond basic "blind hiring." |
| **Pre-LLM PII Stripping** | Uses regex to strip emails and phone numbers *before* sending data to Gemini. | **The Difference**: Prevents the LLM from hallucinating or forming subconscious biases based on email domains (e.g., student vs. enterprise) or regional phone codes. |
| **Context Hash Caching** | Computes a SHA-256 hash of the Resume and JD texts. If seen recently, it returns the previous analysis instantly. | **The Difference**: Saves massive amounts of API quota, reduces response time from 5 seconds to <50ms, and makes the system viable for free-tier users. |
| **Contextual Evaluation** | The LLM prompt forces the model to evaluate *how* a skill was used, not just its presence. | **The Difference**: "Keyword stuffing" (writing "React" repeatedly in white text) works on legacy ATS. AIcruit detects this and rewards candidates who actually describe *building* something with a skill. |

---

## 4. Calculation Examples

### Example A: Normal Mode (Keyword Match)
**Scenario:**
* **Job Description:** Requires "Python", "React", "AWS".
* **Resume:** Mentions "Python", "Javascript", "Azure".

**Calculation/Logic:**
* Looks for exact tokens. Finds "Python", misses "React", misses "AWS". ("Azure" is missed as an AWS alternative).
* **Result:** Very low JD Match Score. (Likely rejected)

### Example B: AI Mode (Semantic Understanding)
**Scenario:** Same as above.

**AI Reasoning (Semantic Mapping):**
1. **Direct Match:** "Python" found fully.
2. **Inferred Match:** JD asks for "AWS" (Cloud). Resume has "Azure". AI understands cloud concepts transfer easily. Awards high partial credit.
3. **Contextual Gap:** JD asks for "React". Resume has "Javascript". AI notes foundation exists but specific framework experience is a gap. Identifies this as a "Critical Gap" to study.
* **Result:** High ATS structure score, moderate JD Match score, with specific advice to brush up on React syntax. (Considered - Good Potential)
