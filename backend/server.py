from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
# Trigger reload for CORS update

from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
import json
import google.generativeai as genai

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

# Create the main app without a prefix
app = FastAPI()

# Add CORS middleware BEFORE including routes
cors_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
cors_origins = [origin.strip() for origin in cors_origins]  # Remove whitespace from each origin

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# AI Resume Analysis Models
class ResumeAnalysisRequest(BaseModel):
    resumeText: str
    jobDescription: Optional[str] = None
    geminiApiKey: Optional[str] = None  # User can provide their own key
    useEmergentKey: bool = True  # Deprecated, kept for compat, maps to Env Key

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

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

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

# AI Resume Analysis Endpoint
@api_router.post("/analyze-resume")
async def analyze_resume(request: ResumeAnalysisRequest):
    """
    Analyze resume using Google Gemini AI directly.
    Supports environment GEMINI_API_KEY and user-provided keys.
    """
    try:
        logger.info("Received AI resume analysis request")
        logger.info(f"Resume length: {len(request.resumeText)} chars")
        logger.info(f"Has Job Description: {bool(request.jobDescription)}")
        
        # Validate input
        if not request.resumeText or not request.resumeText.strip():
            raise HTTPException(status_code=400, detail="Resume text is required")
        
        # Input size validation
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
        
        # Determine which API key to use
        api_key = None
        if request.geminiApiKey and request.geminiApiKey.strip():
            api_key = request.geminiApiKey.strip()
            logger.info("Using user-provided Gemini API key")
        else:
            api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
             # Fallback to check if EMERGENT_LLM_KEY is actually a Gemini Key (unlikely but possible)
            fallback_key = os.environ.get('EMERGENT_LLM_KEY')
            if fallback_key and not fallback_key.startswith('sk-emergent'):
                 api_key = fallback_key
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Server Gemini API key not configured. Please add GEMINI_API_KEY in backend/.env or provide it in the request."
                )
            logger.info("Using server environment API key")
        
        # Security check: Ensure we aren't using the legacy Emergent key with Google Client
        if api_key.startswith('sk-emergent'):
             raise HTTPException(
                status_code=400,
                detail="The provided key is a legacy Emergent key. Please provide a valid Google Gemini API Key (starts with AIza...)."
            )

        # Run the analysis pipeline
        result = await run_analysis_pipeline(
            api_key=api_key,
            resume_text=request.resumeText.strip(),
            job_description=request.jobDescription.strip() if request.jobDescription else None
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in analyze-resume endpoint: {str(e)}", exc_info=True)
        error_message = str(e)
        
        # Handle specific error types
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
        
        # Generic error
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {error_message}"
        )


def get_model():
    """Get the generative model optimized for free tier usage."""
    # Using gemini-2.5-flash-lite for best performance and quota efficiency
    # This is the newest lightweight model with excellent free tier support
    return genai.GenerativeModel('gemini-2.5-flash-lite')

async def run_analysis_pipeline(api_key: str, resume_text: str, job_description: Optional[str]) -> Dict[str, Any]:
    """
    Run the complete resume analysis pipeline using Google Gemini directly.
    Optimized for free tier by reducing API calls from 4 to 1-2 calls.
    """
    logger.info("=== Starting Resume Analysis Pipeline (Free Tier Optimized) ===")
    logger.info(f"JD provided: {bool(job_description)}")
    
    # Configure GenAI
    genai.configure(api_key=api_key)
    
    try:
        if job_description:
            # OPTIMIZED: Single API call for complete analysis with JD
            logger.info("[Optimized] Running complete analysis in single call...")
            final_analysis = await analyze_with_job_description(resume_text, job_description)
        else:
            # OPTIMIZED: Single API call for resume-only analysis
            logger.info("[Optimized] Running resume-only analysis...")
            final_analysis = await analyze_without_job_description(resume_text)
        
        logger.info("=== Pipeline Complete ===")
        return final_analysis
        
    except Exception as e:
        logger.error(f"Pipeline error: {str(e)}", exc_info=True)
        # Attempt to handle 404 model not found by suggesting checking key
        if "404" in str(e) and "models/" in str(e):
             logger.error("Model not found. This may be due to regional restrictions or invalid API key.")
        raise


async def analyze_with_job_description(resume_text: str, job_description: str) -> Dict[str, Any]:
    """Complete analysis with job description in a single API call (Free tier optimized)."""
    model = get_model()
    
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


async def analyze_without_job_description(resume_text: str) -> Dict[str, Any]:
    """Resume-only analysis in a single API call (Free tier optimized)."""
    model = get_model()
    
    prompt = f"""You are an expert ATS analyst. Analyze this resume and provide comprehensive feedback.

RESUME:
{resume_text[:10000]}

Perform a complete ATS and structure analysis (NO job description provided).

### Scoring (calculate precisely):
- ATS Score (0-100): Based on contact info (15), summary (10), experience (15), education (10), skills (10), standard headings (10), plain text (10), action verbs (10), consistent dates (5), single column (5)
- Structure Score (0-100): Based on clear headings (15), formatting (10), bullets (15), quantified achievements (15), length (10), white space (15), logical order (10), no typos (10)

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


# Legacy functions removed - replaced with optimized single-call functions above


def parse_json_response(content: str) -> Dict[str, Any]:
    """Parse JSON from AI response, handling markdown code blocks."""
    try:
        # Remove markdown code blocks if present
        json_content = content
        
        # Try to extract from markdown code block
        import re
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if json_match:
            json_content = json_match.group(1).strip()
        
        # Try to extract JSON object if there's extra text
        object_match = re.search(r'\{[\s\S]*\}', json_content)
        if object_match:
            json_content = object_match.group(0)
        
        return json.loads(json_content)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e}. Content: {content[:500]}")
        raise Exception("JSON_PARSE_ERROR: Failed to parse AI response. Please try again.")


# Include the router in the main app
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
