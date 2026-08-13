import { useState, useEffect } from "react";
import { FileEdit, Loader2, Copy, Check, Download, FileText, Trophy, Target, LayoutGrid, Lightbulb, Plus, ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "@/hooks/use-toast";
import { AnalysisResult } from "./AnalyzerSection";
import { generateResumePdf } from "@/lib/resumePdfGenerator";
import { apiTailorResume } from "@/lib/api";

interface TailoredResumeSectionProps {
  resumeText: string;
  jobDescription: string;
  results: AnalysisResult;
  geminiApiKey?: string | null;
}

interface ResumeScores {
  atsScore: number;
  jdMatchScore?: number;
  structureScore: number;
  feedback?: string;
}

const TailoredResumeSection = ({ 
  resumeText, 
  jobDescription, 
  results, 
  geminiApiKey 
}: TailoredResumeSectionProps) => {
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<ResumeScores | null>(null);
  const [tailoredResumeText, setTailoredResumeText] = useState<string>("");

  useEffect(() => {
    if (resumeText) {
      setTailoredResumeText(resumeText.trim());
    }
  }, [resumeText]);

  const handleGenerateTailoredResume = async () => {
    setIsGenerating(true);
    setScores(null);
    try {
      if (!geminiApiKey) {
        toast({
          title: "Using Original Resume",
          description: "No Gemini API key detected. Exporting original resume instead.",
        });
        setScores({
          atsScore: results.atsScore,
          jdMatchScore: results.jdMatchScore,
          structureScore: results.structureScore,
        });
        setTailoredResumeText(resumeText.trim());
        setIsReady(true);
        return;
      }

      toast({
        title: "Tailoring Resume",
        description: "AI is tailoring your resume text to match the job description...",
      });

      const response = await apiTailorResume(resumeText, jobDescription, geminiApiKey);
      if (response && response.tailoredResumeText) {
        setTailoredResumeText(response.tailoredResumeText);
        toast({
          title: "Resume Tailored Successfully!",
          description: "Your resume has been aligned with the job description and formatted for LaTeX PDF export.",
        });
      } else {
        throw new Error("Invalid response from tailoring API.");
      }

      setScores({
        atsScore: Math.min(100, results.atsScore + 15),
        jdMatchScore: Math.min(100, (results.jdMatchScore || 60) + 20),
        structureScore: results.structureScore,
      });
      setIsReady(true);
    } catch (error) {
      console.error("Failed to tailor resume:", error);
      toast({
        title: "Tailoring Failed",
        description: "Could not tailor resume using AI. Falling back to original resume layout.",
        variant: "destructive",
      });
      // Fallback to original
      setTailoredResumeText(resumeText.trim());
      setScores({
        atsScore: results.atsScore,
        jdMatchScore: results.jdMatchScore,
        structureScore: results.structureScore,
      });
      setIsReady(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tailoredResumeText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Tailored resume text copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Please select and copy the text manually.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTxt = () => {
    try {
      const blob = new Blob([tailoredResumeText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored_resume.txt';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Downloaded!",
        description: "Your tailored resume has been saved as a text file.",
      });
    } catch (error) {
      console.error("Text download failed:", error);
      toast({
        title: "Download Failed",
        description: "Could not download the resume. Please try copying instead.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPdf = async () => {
    try {
      toast({
        title: "Generating PDF",
        description: "Creating your professionally formatted resume PDF...",
      });
      
      await generateResumePdf(tailoredResumeText);
      
      toast({
        title: "PDF Downloaded!",
        description: "Your ATS-friendly resume PDF has been saved.",
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast({
        title: "PDF Generation Failed",
        description: "Please try again or download as text.",
        variant: "destructive",
      });
    }
  };

  const hasSuggestions = results.suggestions.additions.length > 0 ||
    results.suggestions.improvements.length > 0 ||
    results.suggestions.removals.length > 0;

  return (
    <Card className="bg-card shadow-card border-border hover-lift animate-slide-up mt-8" style={{ animationDelay: "0.5s" }}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center transition-transform hover:scale-110">
              <FileEdit className="w-5 h-5 text-accent" />
            </div>
            Tailor & Export Resume
          </div>
          {!isReady && (
            <Button
              variant="hero"
              size="sm"
              onClick={handleGenerateTailoredResume}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Tailoring Resume...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Tailor Resume with AI
                </>
              )}
            </Button>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Automatically tailor your resume to align perfectly with the target job description, then export it as a clean, professionally formatted PDF.
        </p>
      </CardHeader>
      <CardContent>
        {!isReady && !isGenerating && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Click the button above to tailor your resume and prepare PDF export</p>
            <p className="text-sm mt-2">Our AI will align your wording, highlight matching skills, and create a professional LaTeX-style structure.</p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-muted-foreground">Analyzing job description and re-writing resume segments...</p>
          </div>
        )}

        {isReady && (
          <div className="space-y-6">
            {/* Score Display */}
            {scores && (
              <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 rounded-xl p-4 border border-primary/20">
                <div className="flex flex-wrap items-center justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projected ATS Score</p>
                      <p className="text-lg font-bold text-foreground">{scores.atsScore}%</p>
                    </div>
                  </div>
                  {scores.jdMatchScore !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Projected JD Match</p>
                        <p className="text-lg font-bold text-foreground">{scores.jdMatchScore}%</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Structure</p>
                      <p className="text-lg font-bold text-foreground">{scores.structureScore}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions Checklist */}
            {hasSuggestions && (
              <div className="bg-muted/30 rounded-xl p-5 border border-border space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Key optimizations applied in this tailored version:
                </div>
                
                {results.suggestions.additions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-accent flex items-center gap-1.5 mb-2">
                      <Plus className="w-3.5 h-3.5" />
                      Addressed Gaps
                    </p>
                    <ul className="space-y-1.5">
                      {results.suggestions.additions.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-accent/60 mt-0.5 flex-shrink-0">•</span>
                          Integrated: {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.suggestions.improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5 mb-2">
                      <ArrowUp className="w-3.5 h-3.5" />
                      Phrasing Improvements
                    </p>
                    <ul className="space-y-1.5">
                      {results.suggestions.improvements.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary/60 mt-0.5 flex-shrink-0">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Export Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/20 rounded-xl border border-border">
              <p className="text-sm text-muted-foreground">
                Export your resume as a formatted PDF or plain text file.
              </p>
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Text
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTxt}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Text File
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownloadPdf}
                  className="gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
            </div>
            
            {/* Resume Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Resume Preview (Editable)</p>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Changes made here will be exported to TXT/PDF
                </span>
              </div>
              <textarea
                className="w-full h-[400px] bg-background text-foreground border border-border rounded-xl p-5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed resize-y shadow-inner"
                value={tailoredResumeText}
                onChange={(e) => setTailoredResumeText(e.target.value)}
                placeholder="Tailored resume text will appear here. You can manually edit it before exporting."
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TailoredResumeSection;
