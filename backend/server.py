from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import hashlib
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from collections import OrderedDict
import uuid
from datetime import datetime, timedelta
import json
import google.generativeai as genai
from passlib.context import CryptContext
from jose import JWTError, jwt

# ── Step 1: Prompt versioning ───────────────────────────────────────────────
PROMPT_VERSION = "v2.0"

# Configure logging FIRST - before any other code
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth config
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'aicruit-secret-key-change-in-production-2024')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

# ── Step 2: In-memory result cache ──────────────────────────────────────────
class ResultCache:
    """LRU cache keyed by SHA-256 of (resumeText + jobDescription). Max 256 entries."""
    def __init__(self, max_size: int = 256):
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._max_size = max_size

    @staticmethod
    def _make_key(resume_text: str, job_description: str | None) -> str:
        raw = (resume_text or "") + "||" + (job_description or "")
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def put(self, key: str, value: Dict[str, Any]):
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        while len(self._cache) > self._max_size:
            self._cache.popitem(last=False)

result_cache = ResultCache()

# Create the main app without a prefix
app = FastAPI()

# Add CORS middleware BEFORE including routes
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
cors_origins = [origin.strip() for origin in cors_origins]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ── Models ──────────────────────────────────────────────────────────────────

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Auth Models
class UserRegister(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

# ── Step 3: Updated request model ──────────────────────────────────────────
class ResumeAnalysisRequest(BaseModel):
    resumeText: str
    jobDescription: Optional[str] = None
    geminiApiKey: Optional[str] = None
    modelName: Optional[str] = "gemini-2.5-flash-lite"   # for ablation studies
    mode: Optional[str] = "normal"                        # "normal" | "ai_analyse"

# ── Step 4: Updated response model ─────────────────────────────────────────
class ResumeAnalysisResponse(BaseModel):
    atsScore: int
    jdMatchScore: Optional[int] = None
    structureScore: int
    hasJobDescription: bool
    candidateContext: Optional[Dict[str, Any]] = None
    keyFindings: Optional[Dict[str, Any]] = None
    suggestions: Dict[str, List[str]]
    structureAnalysis: Dict[str, Any]
    priorityActions: Optional[List[Dict[str, Any]]] = None
    # New research fields
    analysisId: Optional[str] = None
    promptVersion: Optional[str] = None
    mode: Optional[str] = None
    semanticMatchScore: Optional[float] = None
    scoreBreakdown: Optional[Dict[str, Any]] = None
    biasFlag: Optional[str] = None

# Bias Audit Models
class BiasAuditRequest(BaseModel):
    resumeText: str
    jobDescription: Optional[str] = None
    geminiApiKey: Optional[str] = None
    modelName: Optional[str] = "gemini-2.5-flash-lite"

class BiasVariantResult(BaseModel):
    variant: str
    atsScore: int

class BiasAuditResponse(BaseModel):
    variants: List[BiasVariantResult]
    meanScore: float
    maxVariance: float
    flagged: bool
    message: str


# ── Auth helper functions ───────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user["_id"], "email": user["email"]}


# ── Step 5: PII stripping ──────────────────────────────────────────────────

def strip_pii(text: str) -> str:
    """Remove emails and phone numbers from resume text for scoring consistency."""
    # Strip emails
    text = re.sub(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', '[EMAIL]', text)
    # Strip phone numbers (various formats)
    text = re.sub(
        r'(\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}',
        '[PHONE]', text
    )
    return text


# ── Step 6: Semantic similarity ────────────────────────────────────────────

def compute_semantic_similarity(resume_text: str, job_description: str) -> Optional[float]:
    """Compute cosine similarity between resume and JD using sentence-transformers.
    Returns None if sentence-transformers is not installed."""
    try:
        from sentence_transformers import SentenceTransformer, util
        model = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = model.encode([resume_text[:5000], job_description[:5000]], convert_to_tensor=True)
        cosine_score = util.cos_sim(embeddings[0], embeddings[1]).item()
        return round(cosine_score * 100, 2)  # Return as percentage
    except ImportError:
        logger.warning("sentence-transformers not installed. Semantic similarity will be null.")
        return None
    except Exception as e:
        logger.error(f"Semantic similarity error: {e}")
        return None


# ── Step 7: Bias signal detection ──────────────────────────────────────────

def detect_bias_signals(text: str) -> Optional[str]:
    """Scan resume for demographic fields that shouldn't influence scoring."""
    bias_patterns = {
        "date_of_birth": r'\b(d\.?o\.?b\.?|date\s*of\s*birth|birth\s*date|born\s*on)\b',
        "gender": r'\b(gender|sex)\s*:\s*\w+',
        "marital_status": r'\b(marital\s*status|married|unmarried|single|divorced)\b',
        "caste": r'\b(caste|sc|st|obc|general\s*category)\b',
        "nationality": r'\b(nationality|citizen(ship)?)\s*:',
        "religion": r'\b(religion|hindu|muslim|christian|sikh|buddhist|jain)\s*:?\s',
        "age": r'\bage\s*:\s*\d+',
        "photo": r'\b(photo|photograph|passport\s*size)\b',
    }
    found = []
    text_lower = text.lower()
    for field_name, pattern in bias_patterns.items():
        if re.search(pattern, text_lower):
            found.append(field_name)
    if found:
        return f"Bias-risk fields detected: {', '.join(found)}"
    return None


# ── Step 8: Audit logging to MongoDB ───────────────────────────────────────

async def log_analysis(doc: dict):
    """Fire-and-forget insert into resume_analyses collection."""
    try:
        await db.resume_analyses.insert_one(doc)
        logger.info(f"Analysis logged: {doc.get('analysis_id', 'unknown')}")
    except Exception as e:
        logger.error(f"Failed to log analysis: {e}")


# ── Routes ──────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

# ── Auth Routes ─────────────────────────────────────────────────────────────

@api_router.post("/auth/signup", response_model=Token)
async def signup(body: UserRegister):
    email = body.email.lower().strip()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    user_id = str(uuid.uuid4())
    user_doc = {
        "_id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token({"sub": user_id, "email": email})
    return Token(access_token=token, user={"id": user_id, "email": email})


@api_router.post("/auth/signin", response_model=Token)
async def signin(body: UserLogin):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["_id"], "email": email})
    return Token(access_token=token, user={"id": user["_id"], "email": email})


@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# ── Step 9: Main endpoint wired up ─────────────────────────────────────────

@api_router.post("/analyze-resume")
async def analyze_resume(request: ResumeAnalysisRequest):
    """
    Analyze resume using Google Gemini AI.
    Pipeline: validate → strip PII → detect bias → check cache →
              compute semantic score → run Gemini → log to MongoDB → cache → return.
    """
    try:
        logger.info("Received AI resume analysis request")
        logger.info(f"Resume length: {len(request.resumeText)} chars")
        logger.info(f"Has Job Description: {bool(request.jobDescription)}")
        logger.info(f"Mode: {request.mode}, Model: {request.modelName}")

        # Validate input
        if not request.resumeText or not request.resumeText.strip():
            raise HTTPException(status_code=400, detail="Resume text is required")

        MAX_RESUME_LENGTH = 50000
        MAX_JD_LENGTH = 20000

        if len(request.resumeText) > MAX_RESUME_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Resume too long ({len(request.resumeText)} chars). Max {MAX_RESUME_LENGTH} chars."
            )

        if request.jobDescription and len(request.jobDescription) > MAX_JD_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Job description too long ({len(request.jobDescription)} chars). Max {MAX_JD_LENGTH} chars."
            )

        # Determine API key
        if not request.geminiApiKey or not request.geminiApiKey.strip():
            raise HTTPException(
                status_code=400,
                detail="Gemini API key is required for AI analysis."
            )
        
        api_key = request.geminiApiKey.strip()
        logger.info("Using user-provided Gemini API key")

        resume_text = request.resumeText.strip()
        job_description = request.jobDescription.strip() if request.jobDescription else None

        # Step 5: Strip PII
        cleaned_resume = strip_pii(resume_text)
        logger.info("PII stripped from resume text")

        # Step 7: Detect bias signals
        bias_flag = detect_bias_signals(resume_text)
        if bias_flag:
            logger.warning(f"Bias signals: {bias_flag}")

        # Step 2: Check cache
        cache_key = ResultCache._make_key(cleaned_resume, job_description)
        cached = result_cache.get(cache_key)
        if cached:
            logger.info("Cache hit — returning cached result")
            # Return cached but update the analysis_id for uniqueness
            cached_copy = dict(cached)
            cached_copy["analysisId"] = str(uuid.uuid4())
            return cached_copy

        # Step 6: Compute semantic similarity (only if JD provided)
        semantic_score = None
        if job_description:
            semantic_score = compute_semantic_similarity(cleaned_resume, job_description)
            logger.info(f"Semantic similarity: {semantic_score}")

        # Run the Gemini analysis pipeline
        analysis_id = str(uuid.uuid4())
        result = await run_analysis_pipeline(
            api_key=api_key,
            resume_text=cleaned_resume,
            job_description=job_description,
            model_name=request.modelName or "gemini-2.5-flash-lite",
        )

        # Enrich result with research fields
        result["analysisId"] = analysis_id
        result["promptVersion"] = PROMPT_VERSION
        result["mode"] = request.mode or "normal"
        result["semanticMatchScore"] = semantic_score
        result["biasFlag"] = bias_flag

        # Step 8: Audit log (fire and forget)
        log_doc = {
            "analysis_id": analysis_id,
            "prompt_version": PROMPT_VERSION,
            "mode": request.mode or "normal",
            "model_name": request.modelName or "gemini-2.5-flash-lite",
            "ats_score": result.get("atsScore"),
            "jd_match_score": result.get("jdMatchScore"),
            "structure_score": result.get("structureScore"),
            "semantic_match_score": semantic_score,
            "bias_flag": bias_flag,
            "score_breakdown": result.get("scoreBreakdown"),
            "has_job_description": bool(job_description),
            "resume_length": len(resume_text),
            "jd_length": len(job_description) if job_description else 0,
            "timestamp": datetime.utcnow(),
        }
        asyncio.create_task(log_analysis(log_doc))

        # Step 2: Cache the result
        result_cache.put(cache_key, result)
        logger.info("Result cached")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in analyze-resume endpoint: {str(e)}", exc_info=True)
        error_message = str(e)

        if "403" in error_message:
            raise HTTPException(
                status_code=403,
                detail="API key access denied. Make sure the API key is valid and Generative Language API is enabled."
            )
        if "429" in error_message or "ResourceExhausted" in error_message:
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait a minute or use a different API Key."
            )
        if "404" in error_message and "models/" in error_message:
            raise HTTPException(
                status_code=404,
                detail="The selected AI model is not available for your API key/region. Please try a different key."
            )
        if "JSON_PARSE_ERROR" in error_message:
            raise HTTPException(
                status_code=502,
                detail="AI returned an invalid response. Please try again."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {error_message}"
        )


# ── Step 10: Bias audit endpoint ───────────────────────────────────────────

@api_router.post("/audit-bias", response_model=BiasAuditResponse)
async def audit_bias(request: BiasAuditRequest):
    """
    FAIRE-inspired bias audit: run the same resume through Gemini 4 times
    with swapped names (Western M/F, South Asian M/F) and report score variance.
    Variance > 5 ⇒ flagged.
    """
    try:
        if not request.geminiApiKey or not request.geminiApiKey.strip():
            raise HTTPException(status_code=400, detail="Gemini API key is required for bias audit.")

        api_key = request.geminiApiKey.strip()
        genai.configure(api_key=api_key)

        name_variants = [
            ("Western Male", "John Smith"),
            ("Western Female", "Emily Johnson"),
            ("South Asian Male", "Rahul Sharma"),
            ("South Asian Female", "Priya Patel"),
        ]

        cleaned_resume = strip_pii(request.resumeText.strip())
        # Remove any existing name-like first line
        lines = cleaned_resume.split('\n')
        if lines and len(lines[0].split()) <= 4:
            lines = lines[1:]
        base_resume = '\n'.join(lines)

        variants: List[BiasVariantResult] = []

        for label, name in name_variants:
            test_resume = f"{name}\n{base_resume}"
            try:
                result = await run_analysis_pipeline(
                    api_key=api_key,
                    resume_text=test_resume,
                    job_description=request.jobDescription.strip() if request.jobDescription else None,
                    model_name=request.modelName or "gemini-2.5-flash-lite",
                )
                score = result.get("atsScore", 0)
                variants.append(BiasVariantResult(variant=label, atsScore=score))
                logger.info(f"Bias audit [{label}]: ATS = {score}")
            except Exception as e:
                logger.error(f"Bias audit failed for {label}: {e}")
                variants.append(BiasVariantResult(variant=label, atsScore=-1))

            # Small delay to avoid rate limiting on free tier
            await asyncio.sleep(2)

        valid_scores = [v.atsScore for v in variants if v.atsScore >= 0]
        if not valid_scores:
            raise HTTPException(status_code=502, detail="All bias audit variants failed.")

        mean_score = sum(valid_scores) / len(valid_scores)
        max_variance = max(abs(s - mean_score) for s in valid_scores)
        flagged = max_variance > 5

        return BiasAuditResponse(
            variants=variants,
            meanScore=round(mean_score, 2),
            maxVariance=round(max_variance, 2),
            flagged=flagged,
            message="⚠️ Potential bias detected: score variance > 5 points across name variants."
                    if flagged else "✅ No significant bias detected across name variants.",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bias audit error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Bias audit failed: {str(e)}")


# ── Step 11: Analysis history endpoint ─────────────────────────────────────

@api_router.get("/analyses")
async def get_analyses(
    mode: Optional[str] = Query(None, description="Filter by mode: normal or ai_analyse"),
    limit: int = Query(100, ge=1, le=500, description="Max results to return"),
):
    """Fetch logged analysis runs from MongoDB for research export."""
    try:
        query: Dict[str, Any] = {}
        if mode:
            query["mode"] = mode
        cursor = db.resume_analyses.find(query).sort("timestamp", -1).limit(limit)
        results = await cursor.to_list(length=limit)
        # Convert ObjectId to string for JSON serialization
        for r in results:
            r["_id"] = str(r["_id"])
            if "timestamp" in r and isinstance(r["timestamp"], datetime):
                r["timestamp"] = r["timestamp"].isoformat()
        return results
    except Exception as e:
        logger.error(f"Error fetching analyses: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch analyses: {str(e)}")


# ── Analysis Pipeline ──────────────────────────────────────────────────────

def get_model(model_name: str = "gemini-2.5-flash-lite"):
    """Get the generative model, allowing model selection for ablation."""
    return genai.GenerativeModel(model_name)


async def run_analysis_pipeline(
    api_key: str,
    resume_text: str,
    job_description: Optional[str],
    model_name: str = "gemini-2.5-flash-lite",
) -> Dict[str, Any]:
    """Run the complete resume analysis pipeline using Google Gemini."""
    logger.info(f"=== Starting Analysis Pipeline (model={model_name}) ===")
    logger.info(f"JD provided: {bool(job_description)}")

    genai.configure(api_key=api_key)

    try:
        if job_description:
            logger.info("[Pipeline] Running analysis with JD ...")
            final_analysis = await analyze_with_job_description(resume_text, job_description, model_name)
        else:
            logger.info("[Pipeline] Running resume-only analysis ...")
            final_analysis = await analyze_without_job_description(resume_text, model_name)

        logger.info("=== Pipeline Complete ===")
        return final_analysis

    except Exception as e:
        logger.error(f"Pipeline error: {str(e)}", exc_info=True)
        if "404" in str(e) and "models/" in str(e):
            logger.error("Model not found — may be regional or key issue.")
        raise


# ── Step 12: XAI score breakdown in prompts ────────────────────────────────

async def analyze_with_job_description(resume_text: str, job_description: str, model_name: str = "gemini-2.5-flash-lite") -> Dict[str, Any]:
    """Complete analysis with JD — includes scoreBreakdown for XAI."""
    model = get_model(model_name)

    prompt = f"""You are an expert ATS analyst and career coach. Analyze this resume against the job description and provide comprehensive feedback.

RESUME:
{resume_text[:8000]}

JOB DESCRIPTION:
{job_description[:4000]}

Perform a complete analysis and return a JSON object with:

### Scoring (calculate precisely):
- ATS Score (0-100): Based on contact info (15), summary (10), experience (15), education (10), skills (10), standard headings (10), plain text (10), action verbs (10), consistent dates (5), single column (5)
- JD Match Score (0-100): Based on required skills (40), nice-to-have skills (15), experience years (15), certifications (20), keywords (10)
- Structure Score (0-100): Based on clear headings (15), formatting (10), bullets (15), quantified achievements (15), length (10), white space (15), logical order (10), no typos (10)

### scoreBreakdown (XAI — REQUIRED):
For EACH scoring criterion above, return an object with: criterionName, scoreAwarded, maxPossible, and a short evidence string explaining exactly why that score was given.

### Extract candidate info:
- Name, current role, years of experience, top skills

### Identify:
- Strong matches with JD (specific)
- Critical gaps from JD (specific)
- Quick wins (easy improvements)

### Provide actionable suggestions:
- Specific additions needed
- What to remove
- How to improve existing content

### Section analysis:
- For each section (Contact, Summary, Experience, Skills, Education, Certs): status (good/needs-improvement/missing) + specific feedback

### Priority actions:
- Top 3 most impactful changes with priority 1-3 and impact level

Return ONLY valid JSON in this EXACT format:
{{
  "atsScore": <number>,
  "jdMatchScore": <number>,
  "structureScore": <number>,
  "hasJobDescription": true,
  "scoreBreakdown": {{
    "ats": [
      {{"criterionName": "contactInfo", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "summary", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "experience", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "education", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "skills", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "standardHeadings", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "plainText", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "actionVerbs", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "consistentDates", "scoreAwarded": <number>, "maxPossible": 5, "evidence": "<why>"}},
      {{"criterionName": "singleColumn", "scoreAwarded": <number>, "maxPossible": 5, "evidence": "<why>"}}
    ],
    "jdMatch": [
      {{"criterionName": "requiredSkills", "scoreAwarded": <number>, "maxPossible": 40, "evidence": "<why>"}},
      {{"criterionName": "niceToHaveSkills", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "experienceYears", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "certifications", "scoreAwarded": <number>, "maxPossible": 20, "evidence": "<why>"}},
      {{"criterionName": "keywords", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}}
    ],
    "structure": [
      {{"criterionName": "clearHeadings", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "formatting", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "bullets", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "quantifiedAchievements", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "length", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "whiteSpace", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "logicalOrder", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "noTypos", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}}
    ]
  }},
  "candidateContext": {{
    "name": "<name>",
    "currentRole": "<role>",
    "yearsExperience": "<years>",
    "topSkills": ["<skill1>", "<skill2>", "<skill3>"]
  }},
  "keyFindings": {{
    "strongMatches": ["<specific match>"],
    "criticalGaps": ["<specific gap>"],
    "quickWins": ["<easy fix>"]
  }},
  "suggestions": {{
    "additions": ["<specific addition>"],
    "removals": ["<specific removal>"],
    "improvements": ["<specific improvement>"]
  }},
  "structureAnalysis": {{
    "sections": [
      {{"name": "Contact Information", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Professional Summary", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Work Experience", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Skills", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Education", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Certifications", "status": "good|needs-improvement|missing", "feedback": "<specific>"}}
    ],
    "formatting": ["<recommendation>"]
  }},
  "priorityActions": [
    {{"priority": 1, "action": "<most impactful>", "impact": "high"}},
    {{"priority": 2, "action": "<second>", "impact": "medium"}},
    {{"priority": 3, "action": "<third>", "impact": "low"}}
  ]
}}"""

    try:
        response = await model.generate_content_async(prompt)
        return parse_json_response(response.text)
    except Exception as e:
        logger.error(f"Error in complete analysis: {str(e)}")
        raise


async def analyze_without_job_description(resume_text: str, model_name: str = "gemini-2.5-flash-lite") -> Dict[str, Any]:
    """Resume-only analysis — includes scoreBreakdown for XAI."""
    model = get_model(model_name)

    prompt = f"""You are an expert ATS analyst. Analyze this resume and provide comprehensive feedback.

RESUME:
{resume_text[:10000]}

Perform a complete ATS and structure analysis (NO job description provided).

### Scoring (calculate precisely):
- ATS Score (0-100): Based on contact info (15), summary (10), experience (15), education (10), skills (10), standard headings (10), plain text (10), action verbs (10), consistent dates (5), single column (5)
- Structure Score (0-100): Based on clear headings (15), formatting (10), bullets (15), quantified achievements (15), length (10), white space (15), logical order (10), no typos (10)

### scoreBreakdown (XAI — REQUIRED):
For EACH scoring criterion above, return an object with: criterionName, scoreAwarded, maxPossible, and a short evidence string explaining exactly why that score was given.

### Extract:
- Name, current role, years of experience, top 3 skills

### Identify:
- Strong points in resume
- Areas needing improvement
- Quick fixes

### Provide suggestions:
- Specific additions
- What to remove
- Improvements needed

### Section analysis:
- For each section (Contact, Summary, Experience, Skills, Education, Certs): status + specific feedback

### Priority actions:
- Top 3 most impactful changes

Return ONLY valid JSON in this EXACT format:
{{
  "atsScore": <number>,
  "structureScore": <number>,
  "hasJobDescription": false,
  "scoreBreakdown": {{
    "ats": [
      {{"criterionName": "contactInfo", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "summary", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "experience", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "education", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "skills", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "standardHeadings", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "plainText", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "actionVerbs", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "consistentDates", "scoreAwarded": <number>, "maxPossible": 5, "evidence": "<why>"}},
      {{"criterionName": "singleColumn", "scoreAwarded": <number>, "maxPossible": 5, "evidence": "<why>"}}
    ],
    "structure": [
      {{"criterionName": "clearHeadings", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "formatting", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "bullets", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "quantifiedAchievements", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "length", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "whiteSpace", "scoreAwarded": <number>, "maxPossible": 15, "evidence": "<why>"}},
      {{"criterionName": "logicalOrder", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}},
      {{"criterionName": "noTypos", "scoreAwarded": <number>, "maxPossible": 10, "evidence": "<why>"}}
    ]
  }},
  "candidateContext": {{
    "name": "<name>",
    "currentRole": "<role>",
    "yearsExperience": "<years>",
    "topSkills": ["<skill1>", "<skill2>", "<skill3>"]
  }},
  "keyFindings": {{
    "strongMatches": ["<strong point>"],
    "criticalGaps": ["<improvement area>"],
    "quickWins": ["<easy fix>"]
  }},
  "suggestions": {{
    "additions": ["<specific>"],
    "removals": ["<specific>"],
    "improvements": ["<specific>"]
  }},
  "structureAnalysis": {{
    "sections": [
      {{"name": "Contact Information", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Professional Summary", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Work Experience", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Skills", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Education", "status": "good|needs-improvement|missing", "feedback": "<specific>"}},
      {{"name": "Certifications", "status": "good|needs-improvement|missing", "feedback": "<specific>"}}
    ],
    "formatting": ["<recommendation>"]
  }},
  "priorityActions": [
    {{"priority": 1, "action": "<most impactful>", "impact": "high"}},
    {{"priority": 2, "action": "<second>", "impact": "medium"}},
    {{"priority": 3, "action": "<third>", "impact": "low"}}
  ]
}}"""

    try:
        response = await model.generate_content_async(prompt)
        return parse_json_response(response.text)
    except Exception as e:
        logger.error(f"Error in resume-only analysis: {str(e)}")
        raise


def parse_json_response(content: str) -> Dict[str, Any]:
    """Parse JSON from AI response, handling markdown code blocks."""
    try:
        json_content = content
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if json_match:
            json_content = json_match.group(1).strip()
        object_match = re.search(r'\{[\s\S]*\}', json_content)
        if object_match:
            json_content = object_match.group(0)
        return json.loads(json_content)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e}. Content: {content[:500]}")
        raise Exception("JSON_PARSE_ERROR: Failed to parse AI response. Please try again.")


# ── Include router & lifecycle ──────────────────────────────────────────────

app.include_router(api_router)


@app.on_event("startup")
async def startup_create_indexes():
    """Create MongoDB indexes on resume_analyses for fast research queries."""
    try:
        await db.resume_analyses.create_index("timestamp")
        await db.resume_analyses.create_index("mode")
        await db.resume_analyses.create_index("prompt_version")
        logger.info("MongoDB indexes created on resume_analyses collection")
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
