import { useState } from "react";
import {
  Plus,
  Minus,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  XCircle,
  RotateCcw,
  FileText,
  Trophy,
  Download,
  FileDown,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import ScoreCard from "./ScoreCard";
import { cn } from "@/lib/utils";
import { AnalysisResult, ScoreBreakdownItem } from "./AnalyzerSection";
import { generateAnalysisReport } from "@/lib/pdfGenerator";
import { toast } from "@/hooks/use-toast";

interface ResultsSectionProps {
  results: AnalysisResult;
  resumeText: string;
  jobDescription: string;
  onReset: () => void;
}

const ResultsSection = ({
  results,
  resumeText,
  jobDescription,
  onReset,
}: ResultsSectionProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hasJD =
    results.hasJobDescription && results.jdMatchScore !== undefined;
  const overallScore = hasJD
    ? Math.round(
        (results.atsScore +
          (results.jdMatchScore || 0) +
          results.structureScore) /
          3
      )
    : Math.round((results.atsScore + results.structureScore) / 2);

  const handleDownloadReport = async () => {
    try {
      await generateAnalysisReport(results);
      toast({
        title: "Report Downloaded",
        description: "Your analysis report has been saved as a PDF.",
      });
    } catch (error) {
      console.error("Failed to generate report:", error);
      toast({
        title: "Download Failed",
        description:
          "There was an error generating your report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportImprovedResume = async () => {
    setIsGenerating(true);
    try {
      const lines: string[] = [];
      if (results.suggestions.additions.length) {
        lines.push("=== ADDITIONS ===");
        results.suggestions.additions.forEach((s, i) =>
          lines.push(`${i + 1}. ${s}`)
        );
      }
      if (results.suggestions.improvements.length) {
        lines.push("\n=== IMPROVEMENTS ===");
        results.suggestions.improvements.forEach((s, i) =>
          lines.push(`${i + 1}. ${s}`)
        );
      }
      if (results.suggestions.removals.length) {
        lines.push("\n=== REMOVALS ===");
        results.suggestions.removals.forEach((s, i) =>
          lines.push(`${i + 1}. ${s}`)
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume-suggestions.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Suggestions Downloaded",
        description: "Apply these changes to your resume for a better score.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getStatusIcon = (
    status: "good" | "needs-improvement" | "missing"
  ) => {
    switch (status) {
      case "good":
        return <CheckCircle className="w-4 h-4 text-accent" />;
      case "needs-improvement":
        return <AlertCircle className="w-4 h-4 text-score-average" />;
      case "missing":
        return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const getStatusBg = (
    status: "good" | "needs-improvement" | "missing"
  ) => {
    switch (status) {
      case "good":
        return "bg-accent/10 hover:bg-accent/15";
      case "needs-improvement":
        return "bg-score-average/10 hover:bg-score-average/15";
      case "missing":
        return "bg-destructive/10 hover:bg-destructive/15";
    }
  };

  const getATSTips = (score: number): string[] => {
    const tips = [];
    if (score < 80)
      tips.push(
        "Use standard section headings like 'Work Experience' and 'Education'"
      );
    if (score < 70)
      tips.push("Avoid tables, graphics, and complex formatting");
    if (score < 60)
      tips.push("Use a single-column layout for better parsing");
    if (score < 50)
      tips.push("Remove headers and footers that may confuse ATS");
    tips.push("Save your resume as a .docx or PDF format");
    tips.push("Use standard fonts like Arial, Calibri, or Times New Roman");
    return tips.slice(0, 5);
  };

  const getJDMatchTips = (score: number): string[] => {
    const tips = [];
    if (score < 80)
      tips.push("Mirror the exact keywords from the job description");
    if (score < 70)
      tips.push(
        "Include both spelled-out terms and acronyms (e.g., 'Search Engine Optimization (SEO)')"
      );
    if (score < 60)
      tips.push(
        "Add relevant technical skills mentioned in the job posting"
      );
    if (score < 50)
      tips.push("Quantify your achievements with metrics and numbers");
    tips.push("Tailor your summary to match the role requirements");
    tips.push(
      "Include industry-specific terminology and certifications"
    );
    return tips.slice(0, 5);
  };

  const getStructureTips = (score: number): string[] => {
    const tips = [];
    if (score < 80)
      tips.push("Ensure consistent date formatting throughout");
    if (score < 70) tips.push("Use bullet points for better readability");
    if (score < 60)
      tips.push("Keep your resume to 1-2 pages maximum");
    if (score < 50)
      tips.push("Add a professional summary at the top");
    tips.push("Use action verbs to start each bullet point");
    tips.push(
      "Group related information under clear section headings"
    );
    return tips.slice(0, 5);
  };

  const renderBreakdownTable = (
    title: string,
    items: ScoreBreakdownItem[] | undefined,
    colorClass: string
  ) => {
    if (!items || items.length === 0) return null;
    const totalAwarded = items.reduce((s, i) => s + i.scoreAwarded, 0);
    const totalMax = items.reduce((s, i) => s + i.maxPossible, 0);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-foreground">{title}</h4>
          <span
            className={cn(
              "text-xs font-mono px-2 py-1 rounded-md",
              colorClass
            )}
          >
            {totalAwarded}/{totalMax}
          </span>
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium text-muted-foreground">
                  Criterion
                </th>
                <th className="text-center p-2 font-medium text-muted-foreground w-20">
                  Score
                </th>
                <th className="text-left p-2 font-medium text-muted-foreground">
                  Evidence
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const pct =
                  item.maxPossible > 0
                    ? (item.scoreAwarded / item.maxPossible) * 100
                    : 0;
                return (
                  <tr
                    key={item.criterionName}
                    className={cn(
                      "border-t border-border transition-colors hover:bg-muted/30",
                      i % 2 === 0 ? "bg-background" : "bg-muted/10"
                    )}
                  >
                    <td className="p-2 font-medium text-foreground capitalize">
                      {item.criterionName.replace(/([A-Z])/g, " $1").trim()}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            pct >= 80
                              ? "text-accent"
                              : pct >= 50
                              ? "text-primary"
                              : "text-destructive"
                          )}
                        >
                          {item.scoreAwarded}
                        </span>
                        <span className="text-muted-foreground">
                          /{item.maxPossible}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {item.evidence}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Bias Flag Warning */}
      {results.biasFlag && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 animate-scale-in">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm text-amber-600 dark:text-amber-400">
              Bias Risk Detected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {results.biasFlag}
            </p>
          </div>
        </div>
      )}

      {/* Overall Score Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 rounded-2xl p-6 md:p-8 border border-primary/20 animate-scale-in">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-hero flex items-center justify-center shadow-elevated">
              <Trophy className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Overall Resume Score
              </p>
              <p className="font-display text-3xl font-bold text-foreground">
                {overallScore}%
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-md text-center md:text-right">
            {overallScore >= 80
              ? "Excellent! Your resume is well-optimized for ATS systems."
              : overallScore >= 60
              ? "Good progress! Tap on each score card below for specific improvement tips."
              : "Your resume needs work. Tap on each score card to see how to improve."}
          </p>
        </div>
      </div>

      {/* Interactive Score Cards */}
      <div
        className={`grid gap-6 ${
          hasJD
            ? results.semanticMatchScore !== undefined && results.semanticMatchScore !== null
              ? "md:grid-cols-4"
              : "md:grid-cols-3"
            : results.semanticMatchScore !== undefined && results.semanticMatchScore !== null
            ? "md:grid-cols-3"
            : "md:grid-cols-2"
        }`}
      >
        <ScoreCard
          score={results.atsScore}
          label="ATS Score"
          description="How well your resume parses through ATS systems"
          tips={getATSTips(results.atsScore)}
          delay="0s"
        />
        {hasJD && (
          <ScoreCard
            score={results.jdMatchScore!}
            label="JD Match"
            description="Keyword and skill alignment with job description"
            tips={getJDMatchTips(results.jdMatchScore!)}
            delay="0.1s"
          />
        )}
        <ScoreCard
          score={results.structureScore}
          label="Structure"
          description="Resume format and section organization"
          tips={getStructureTips(results.structureScore)}
          delay={hasJD ? "0.2s" : "0.1s"}
        />
        {results.semanticMatchScore !== undefined &&
          results.semanticMatchScore !== null && (
            <ScoreCard
              score={Math.round(results.semanticMatchScore)}
              label="Semantic Match"
              description="AI embedding similarity between resume and JD"
              tips={[
                "This score uses sentence-transformer embeddings",
                "Higher scores mean better contextual alignment",
                "Improve by using similar language to the JD",
              ]}
              delay={hasJD ? "0.3s" : "0.2s"}
            />
          )}
      </div>

      {/* XAI Score Breakdown (Expandable) */}
      {results.scoreBreakdown && (
        <Card
          className="bg-card shadow-card border-border hover-lift animate-slide-up cursor-pointer"
          style={{ animationDelay: "0.35s" }}
        >
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowBreakdown(!showBreakdown)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center transition-transform hover:scale-110">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                </div>
                XAI Score Breakdown
              </CardTitle>
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-xs font-medium">
                  {showBreakdown ? "Hide details" : "Show details"}
                </span>
                {showBreakdown ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Per-criterion explainability: see exactly why each score was
              awarded with evidence.
            </p>
          </CardHeader>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              showBreakdown ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <CardContent className="space-y-6 pt-0">
              {renderBreakdownTable(
                "ATS Score Breakdown",
                results.scoreBreakdown.ats,
                "bg-primary/10 text-primary"
              )}
              {hasJD &&
                renderBreakdownTable(
                  "JD Match Breakdown",
                  results.scoreBreakdown.jdMatch,
                  "bg-accent/10 text-accent"
                )}
              {renderBreakdownTable(
                "Structure Breakdown",
                results.scoreBreakdown.structure,
                "bg-indigo-500/10 text-indigo-500"
              )}
            </CardContent>
          </div>
        </Card>
      )}

      {/* Suggestions Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Additions */}
        <Card
          className="bg-card shadow-card border-border hover-lift animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center transition-transform hover:scale-110">
                <Plus className="w-5 h-5 text-accent" />
              </div>
              Add to Resume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {results.suggestions.additions.map((item, index) => {
                const displayText =
                  typeof item === "string"
                    ? item
                    : (item as { change?: string; improved?: string })
                        .change || JSON.stringify(item);
                return (
                  <li
                    key={index}
                    className="flex gap-3 text-sm text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors animate-slide-left"
                    style={{ animationDelay: `${0.2 + index * 0.05}s` }}
                  >
                    <span className="text-accent mt-0.5 font-bold">+</span>
                    <span>{displayText}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Removals */}
        <Card
          className="bg-card shadow-card border-border hover-lift animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center transition-transform hover:scale-110">
                <Minus className="w-5 h-5 text-destructive" />
              </div>
              Remove from Resume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {results.suggestions.removals.map((item, index) => {
                const displayText =
                  typeof item === "string"
                    ? item
                    : (item as { change?: string; improved?: string })
                        .change || JSON.stringify(item);
                return (
                  <li
                    key={index}
                    className="flex gap-3 text-sm text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors animate-slide-left"
                    style={{ animationDelay: `${0.3 + index * 0.05}s` }}
                  >
                    <span className="text-destructive mt-0.5 font-bold">
                      −
                    </span>
                    <span>{displayText}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Improvements */}
        <Card
          className="bg-card shadow-card border-border hover-lift animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              Improvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {results.suggestions.improvements.map((item, index) => {
                const displayText =
                  typeof item === "string"
                    ? item
                    : (item as { change?: string; improved?: string })
                        .improved ||
                      (item as { change?: string; improved?: string })
                        .change ||
                      JSON.stringify(item);
                return (
                  <li
                    key={index}
                    className="flex gap-3 text-sm text-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors animate-slide-left"
                    style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                  >
                    <span className="text-primary mt-0.5">→</span>
                    <span>{displayText}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Structure Analysis */}
      <Card
        className="bg-card shadow-card border-border hover-lift animate-slide-up"
        style={{ animationDelay: "0.4s" }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            Resume Structure Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Sections Check */}
            <div>
              <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Section Checklist
              </h4>
              <div className="space-y-2">
                {results.structureAnalysis.sections.map(
                  (section, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-default animate-slide-right",
                        getStatusBg(section.status)
                      )}
                      style={{
                        animationDelay: `${0.5 + index * 0.05}s`,
                      }}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {section.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground capitalize">
                          {section.status.replace("-", " ")}
                        </span>
                        {getStatusIcon(section.status)}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Formatting Tips */}
            <div>
              <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                Formatting Recommendations
              </h4>
              <ul className="space-y-3">
                {results.structureAnalysis.formatting.map(
                  (tip, index) => (
                    <li
                      key={index}
                      className="flex gap-3 text-sm text-muted-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors animate-slide-right"
                      style={{
                        animationDelay: `${0.6 + index * 0.05}s`,
                      }}
                    >
                      <span className="text-primary mt-0.5 font-mono text-xs">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{tip}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata Footer */}
      {(results.analysisId || results.promptVersion) && (
        <div
          className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground/60 animate-fade-in"
          style={{ animationDelay: "0.8s" }}
        >
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            <span>Research Metadata</span>
          </div>
          {results.analysisId && (
            <span className="px-2 py-1 bg-muted/30 rounded font-mono">
              ID: {results.analysisId.slice(0, 8)}…
            </span>
          )}
          {results.promptVersion && (
            <span className="px-2 py-1 bg-muted/30 rounded font-mono">
              Prompt: {results.promptVersion}
            </span>
          )}
          {results.mode && (
            <span className="px-2 py-1 bg-muted/30 rounded font-mono">
              Mode: {results.mode}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in"
        style={{ animationDelay: "0.7s" }}
      >
        <Button
          variant="hero"
          size="lg"
          onClick={handleExportImprovedResume}
          disabled={isGenerating}
          className="gap-2 group hover-lift"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4 transition-transform group-hover:-translate-y-1 duration-300" />
              Export Improved Resume
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleDownloadReport}
          className="gap-2 group hover-lift"
        >
          <Download className="w-4 h-4 transition-transform group-hover:-translate-y-1 duration-300" />
          Download Report
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onReset}
          className="gap-2 group hover-lift"
        >
          <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-180 duration-500" />
          Analyze Another
        </Button>
      </div>
    </div>
  );
};

export default ResultsSection;
