import { useState } from "react";
import { FileEdit, Loader2, Copy, Check, Download, FileText, Trophy, Target, LayoutGrid, Lightbulb, Plus, ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "@/hooks/use-toast";
import { AnalysisResult } from "./AnalyzerSection";
import { generateResumePdf } from "@/lib/resumePdfGenerator";

interface TailoredResumeSectionProps {
  resumeText: string;
  jobDescription: string;
  results: AnalysisResult;
}

interface ResumeScores {
  atsScore: number;
  jdMatchScore?: number;
  structureScore: number;
  feedback?: string;
}

const TailoredResumeSection = ({ resumeText, jobDescription, results }: TailoredResumeSectionProps) => {
  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<ResumeScores | null>(null);

  // The clean resume text is always the original — used for PDF/TXT export
  const cleanResumeText = resumeText.trim();

  const handleGenerateTailoredResume = async () => {
    setIsGenerating(true);
    setScores(null);
    try {
      toast({
        title: "Preparing Your Resume",
        description: "Formatting your resume for export...",
      });

      setScores({
        atsScore: results.atsScore,
        jdMatchScore: results.jdMatchScore,
        structureScore: results.structureScore,
      });
      setIsReady(true);

      toast({
        title: "Resume Ready!",
        description: "Your resume is ready for export as a professionally formatted PDF.",
      });
    } catch (error) {
      console.error("Failed to prepare resume:", error);
      toast({
        title: "Preparation Failed",
        description: error instanceof Error ? error.message : "Failed to prepare resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanResumeText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Resume text copied to clipboard.",
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
      const blob = new Blob([cleanResumeText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resume.txt';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast({
        title: "Downloaded!",
        description: "Your resume has been saved as a text file.",
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
      
      await generateResumePdf(cleanResumeText);
      
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
            Export Improved Resume
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
                  Preparing...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Prepare Resume for Export
                </>
              )}
            </Button>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Export your resume as a professionally formatted, ATS-friendly PDF. Review the suggestions below and apply them to your resume before exporting.
        </p>
      </CardHeader>
      <CardContent>
        {!isReady && !isGenerating && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Click the button above to prepare your resume for PDF export</p>
            <p className="text-sm mt-2">Your resume will be formatted into a clean, professional PDF document</p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-muted-foreground">Preparing your resume...</p>
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
                      <p className="text-xs text-muted-foreground">ATS Score</p>
                      <p className="text-lg font-bold text-foreground">{scores.atsScore}%</p>
                    </div>
                  </div>
                  {scores.jdMatchScore !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Target className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">JD Match</p>
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
                {scores.feedback && (
                  <p className="text-xs text-muted-foreground text-center mt-3">{scores.feedback}</p>
                )}
              </div>
            )}

            {/* Suggestions to apply before exporting */}
            {hasSuggestions && (
              <div className="bg-muted/30 rounded-xl p-5 border border-border space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  Apply these suggestions to your resume before exporting:
                </div>
                
                {results.suggestions.additions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-accent flex items-center gap-1.5 mb-2">
                      <Plus className="w-3.5 h-3.5" />
                      Suggested Additions
                    </p>
                    <ul className="space-y-1.5">
                      {results.suggestions.additions.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-accent/60 mt-0.5 flex-shrink-0">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.suggestions.improvements.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-primary flex items-center gap-1.5 mb-2">
                      <ArrowUp className="w-3.5 h-3.5" />
                      Suggested Improvements
                    </p>
                    <ul className="space-y-1.5">
                      {results.suggestions.improvements.map((s, i) => (
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
              <div className="flex gap-2">
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
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Resume Preview</p>
              <div className="bg-muted/30 rounded-xl p-6 border border-border max-h-[500px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed text-left">{cleanResumeText}</pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TailoredResumeSection;
