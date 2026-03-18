import { useState, useEffect } from "react";
import { Sparkles, Loader2, Brain, Zap, Cpu, Key, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import FileUpload from "./FileUpload";
import TextInput from "./TextInput";
import ResultsSection from "./ResultsSection";
import ResumeChat from "./ResumeChat";
import TailoredResumeSection from "./TailoredResumeSection";
import LoginPrompt from "./LoginPrompt";
import AnalysisHistory from "./AnalysisHistory";
import BiasAuditSection from "./BiasAuditSection";
import ApiKeyDialog from "./profile/ApiKeyDialog";
import { toast } from "@/hooks/use-toast";

import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { extractTextFromPDF, isValidPDFFile } from "@/lib/pdfParser";
import { analyzeResumeLocally } from "@/lib/localResumeAnalyzer";

export interface ScoreBreakdownItem {
  criterionName: string;
  scoreAwarded: number;
  maxPossible: number;
  evidence: string;
}

export interface AnalysisResult {
  atsScore: number;
  jdMatchScore?: number;
  structureScore: number;
  hasJobDescription: boolean;
  suggestions: {
    additions: string[];
    removals: string[];
    improvements: string[];
  };
  structureAnalysis: {
    sections: { name: string; status: "good" | "needs-improvement" | "missing"; feedback?: string }[];
    formatting: string[];
  };
  candidateContext?: {
    name: string;
    currentRole: string;
    yearsExperience: string;
    topSkills: string[];
  };
  keyFindings?: {
    strongMatches: string[];
    criticalGaps: string[];
    quickWins: string[];
  };
  // Research enhancement fields
  analysisId?: string;
  promptVersion?: string;
  mode?: string;
  semanticMatchScore?: number;
  scoreBreakdown?: {
    ats?: ScoreBreakdownItem[];
    jdMatch?: ScoreBreakdownItem[];
    structure?: ScoreBreakdownItem[];
  };
  biasFlag?: string;
}

type AnalysisMode = "normal" | "ai";

const AnalyzerSection = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { geminiApiKey, hasApiKey, isLoading: profileLoading } = useProfile();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  
  // Mode selection and API key dialog state
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("normal");
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState(false);

  // When API key is successfully saved and we have pending analysis, trigger it
  useEffect(() => {
    if (pendingAnalysis && hasApiKey) {
      setPendingAnalysis(false);
      handleAnalyze();
    }
  }, [hasApiKey, pendingAnalysis]);

  const handleFileSelect = async (file: File | null) => {
    setResumeFile(file);
    
    if (file && isValidPDFFile(file)) {
      setIsParsing(true);
      try {
        const text = await extractTextFromPDF(file);
        setResumeText(text);
        toast({
          title: "PDF Parsed Successfully",
          description: `Extracted ${text.length} characters from your resume.`,
        });
      } catch (error) {
        console.error("PDF parsing error:", error);
        toast({
          title: "PDF Parsing Failed",
          description: "Could not extract text from PDF. Please paste your resume text manually.",
          variant: "destructive",
        });
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!resumeFile && !resumeText.trim()) {
      toast({
        title: "Missing Resume",
        description: "Please upload a resume file or paste your resume text.",
        variant: "destructive",
      });
      return;
    }

    // For AI mode, user MUST have an API key configured
    if (analysisMode === "ai" && !hasApiKey) {
      setShowApiKeyDialog(true);
      setPendingAnalysis(true);
      return;
    }

    setIsAnalyzing(true);

    try {
      // Get resume text - either from parsed PDF or manual input
      let finalResumeText = resumeText.trim();
      
      if (!finalResumeText && resumeFile) {
        // If we have a file but no text, try to parse it
        if (isValidPDFFile(resumeFile)) {
          finalResumeText = await extractTextFromPDF(resumeFile);
        } else {
          toast({
            title: "Unsupported File",
            description: "Please upload a PDF file or paste your resume text.",
            variant: "destructive",
          });
          setIsAnalyzing(false);
          return;
        }
      }

      let analysisResult: AnalysisResult;

      if (analysisMode === "normal") {
        // Local TF-IDF based analysis
        analysisResult = analyzeResumeLocally(finalResumeText, jobDescription.trim() || null);
        
        toast({
          title: "Analysis Complete!",
          description: "Your resume has been analyzed locally using keyword matching.",
        });
      } else {
        // AI-powered analysis using Gemini via backend API
        const backendUrl = import.meta.env.VITE_APP_BACKEND_URL || '';
        
        const requestBody: any = {
          resumeText: finalResumeText,
          jobDescription: jobDescription.trim() || null,
          mode: "ai_analyse",
          modelName: "gemini-2.5-flash-lite",
        };

        // If user has provided their own Gemini API key, use it
        if (geminiApiKey && geminiApiKey.trim()) {
          requestBody.geminiApiKey = geminiApiKey.trim();
        } else {
          throw new Error("Gemini API key is required for AI analysis.");
        }

        const response = await fetch(`${backendUrl}/api/analyze-resume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
          const errorMsg = errorData.detail || errorData.message || 'Failed to analyze resume';
          
          // Parse specific error types for better user feedback
          if (response.status === 401 || errorMsg.includes("INVALID_API_KEY")) {
            throw new Error("Invalid Gemini API key. Please check your key and try again.");
          } else if (response.status === 403 || errorMsg.includes("API_KEY_FORBIDDEN")) {
            throw new Error("API key access denied. Make sure the Generative Language API is enabled in your Google Cloud Console.");
          } else if (response.status === 429 || errorMsg.includes("RATE_LIMITED")) {
            throw new Error("Gemini API rate limit reached. Please wait a few minutes and try again.");
          }
          
          throw new Error(errorMsg);
        }

        analysisResult = await response.json() as AnalysisResult;

        toast({
          title: "Analysis Complete!",
          description: "Your resume has been analyzed with AI. Check out the personalized results below.",
        });
      }

      setResults(analysisResult);

      // Save to database
      if (user) {
        await saveAnalysisToHistory(finalResumeText, analysisResult);
      }

    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveAnalysisToHistory = async (resumeTextToSave: string, analysisResult: AnalysisResult) => {
    try {
      if (!user) return;
      const storageKey = `aicruit_history_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const entry = {
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        resume_text: resumeTextToSave,
        job_description: jobDescription.trim() || null,
        ats_score: analysisResult.atsScore,
        jd_match_score: analysisResult.jdMatchScore ?? null,
        structure_score: analysisResult.structureScore,
        suggestions: analysisResult.suggestions,
        structure_analysis: analysisResult.structureAnalysis,
        candidate_context: analysisResult.candidateContext ?? null,
      };
      // Keep last 10 entries
      const updated = [entry, ...existing].slice(0, 10);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save analysis:", error);
    }
  };

  const resetAnalysis = () => {
    setResults(null);
    setResumeFile(null);
    setResumeText("");
    setJobDescription("");
  };

  const handleLoadAnalysis = (result: AnalysisResult, loadedResumeText: string, loadedJobDescription: string) => {
    setResults(result);
    setResumeText(loadedResumeText);
    setJobDescription(loadedJobDescription);
  };

  // Show loading state while checking auth or profile
  if (authLoading || profileLoading) {
    return (
      <section id="analyzer" className="py-16 lg:py-24">
        <div className="container mx-auto px-4 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <section id="analyzer" className="py-16 lg:py-24 relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Brain className="w-3.5 h-3.5" />
              Resume Analysis
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Resume Analyzer
            </h2>
            <p className="text-muted-foreground text-lg">
              Sign in to analyze your resume and track your progress.
            </p>
          </div>
          <LoginPrompt />
        </div>
      </section>
    );
  }

  return (
    <section id="analyzer" className="py-16 lg:py-24 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Brain className="w-3.5 h-3.5" />
            Resume Analysis
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Resume Analyzer
          </h2>
          <p className="text-muted-foreground text-lg">
            Upload your resume to get instant ATS score. Add a job description for JD match analysis.
          </p>
          
          {/* History button */}
          <div className="mt-4">
            <AnalysisHistory onLoadAnalysis={handleLoadAnalysis} />
          </div>
        </div>

        {!results ? (
          <div className="max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="bg-card rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 p-6 md:p-8 border border-border card-shine">
              
              {/* Mode Selection */}
              <div className="mb-8">
                <Label className="text-sm font-medium mb-3 block">Analysis Mode</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setAnalysisMode("normal")}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      analysisMode === "normal"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${analysisMode === "normal" ? "bg-primary/10" : "bg-muted"}`}>
                        <Cpu className={`w-5 h-5 ${analysisMode === "normal" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <span className="font-semibold">Normal Review</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fast, local analysis using TF-IDF keyword matching. No API key required.
                    </p>
                  </button>
                  
                  <button
                    onClick={() => setAnalysisMode("ai")}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      analysisMode === "ai"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${analysisMode === "ai" ? "bg-primary/10" : "bg-muted"}`}>
                        <Sparkles className={`w-5 h-5 ${analysisMode === "ai" ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <span className="font-semibold">AI Review</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Advanced AI analysis using Google Gemini. Requires your own Gemini API key.
                    </p>
                  </button>
                </div>
              </div>

              {/* API Key Status (only shown for AI mode) */}
              {analysisMode === "ai" && (
                <div className="mb-8 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-medium">
                        Gemini API Key (Required)
                      </Label>
                    </div>
                    {hasApiKey ? (
                      <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span>Configured</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowApiKeyDialog(true)}
                      >
                        Add Your Key
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasApiKey 
                      ? "Your API key is securely stored and will be used for analysis."
                      : "No API key configured. You must add your own Gemini API key to use AI analysis."
                    }
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-6">
                  <FileUpload
                    label="Upload Resume (PDF)"
                    onFileSelect={handleFileSelect}
                    file={resumeFile}
                    isLoading={isParsing}
                  />
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-medium">OR</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <TextInput
                    label="Paste Resume Text"
                    placeholder="Paste your resume content here..."
                    value={resumeText}
                    onChange={setResumeText}
                    rows={8}
                  />
                </div>

                <div>
                  <TextInput
                    label="Job Description (Optional)"
                    placeholder="Paste the job description here for JD match analysis..."
                    value={jobDescription}
                    onChange={setJobDescription}
                    rows={16}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Add a job description to get JD match score and tailored suggestions.
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="hero"
                  size="xl"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="min-w-[220px] group relative overflow-hidden"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="animate-pulse">Analyzing...</span>
                    </>
                  ) : (
                    <>
                      {analysisMode === "ai" ? (
                        <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
                      ) : (
                        <Cpu className="w-5 h-5 transition-transform group-hover:rotate-12" />
                      )}
                      {analysisMode === "ai" ? "AI Analyze" : "Analyze Resume"}
                      <Zap className="w-4 h-4 absolute right-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 translate-x-2" />
                    </>
                  )}
                </Button>
              </div>

              {/* API Key Dialog */}
              <ApiKeyDialog
                isOpen={showApiKeyDialog}
                onClose={() => {
                  setShowApiKeyDialog(false);
                  setPendingAnalysis(false);
                }}
                onSuccess={() => {
                  // Analysis will be triggered by useEffect when hasApiKey becomes true
                }}
              />
              
              {/* Feature hints */}
              <div className="flex flex-wrap justify-center gap-4 mt-6 text-xs text-muted-foreground">
                {[
                  "ATS Score", 
                  "Structure Analysis", 
                  "Suggestions", 
                  jobDescription.trim() ? "JD Match" : "",
                  analysisMode === "ai" ? "AI-Powered" : "Local Analysis"
                ].filter(Boolean).map((feature) => (
                  <span key={feature} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <ResultsSection 
              results={results} 
              resumeText={resumeText}
              jobDescription={jobDescription}
              onReset={resetAnalysis} 
            />
            {analysisMode === "ai" && (
              <BiasAuditSection
                resumeText={resumeText}
                jobDescription={jobDescription}
                geminiApiKey={geminiApiKey}
              />
            )}
            <TailoredResumeSection
              resumeText={resumeText}
              jobDescription={jobDescription}
              results={results}
            />
            <ResumeChat 
              resumeText={resumeText} 
              jobDescription={jobDescription} 
              analysisResults={results}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default AnalyzerSection;
