import { useState } from "react";
import {
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Users,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";

interface BiasVariantResult {
  variant: string;
  atsScore: number;
}

interface BiasAuditResult {
  variants: BiasVariantResult[];
  meanScore: number;
  maxVariance: number;
  flagged: boolean;
  message: string;
}

interface BiasAuditSectionProps {
  resumeText: string;
  jobDescription: string;
  geminiApiKey?: string | null;
}

const BiasAuditSection = ({
  resumeText,
  jobDescription,
  geminiApiKey,
}: BiasAuditSectionProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BiasAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunAudit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const backendUrl = getApiBaseUrl();
      const response = await fetch(`${backendUrl || "/api"}/audit-bias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription: jobDescription?.trim() || null,
          geminiApiKey: geminiApiKey?.trim() || null,
          modelName: "gemini-1.5-flash",
        }),
      });

      if (!response.ok) {
        const errData = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));
        throw new Error(errData.detail || "Bias audit failed");
      }

      const data: BiasAuditResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance <= 2) return "text-accent";
    if (variance <= 5) return "text-score-average";
    return "text-destructive";
  };

  return (
    <div className="max-w-6xl mx-auto mt-8 animate-fade-in">
      <Card className="bg-card shadow-card border-border hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center transition-transform hover:scale-110">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            Bias Audit (FAIRE Methodology)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Runs your resume through the AI with 4 swapped name variants
            (Western M/F, South Asian M/F) to detect potential scoring bias. A
            variance &gt; 5 points is flagged.
          </p>
        </CardHeader>
        <CardContent>
          {!result && !isLoading && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Users className="w-12 h-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                This test calls the AI 4 times with different name variants. It
                may take ~30 seconds and uses additional API quota.
              </p>
              <Button
                variant="outline"
                size="lg"
                onClick={handleRunAudit}
                className="gap-2 group"
              >
                <Shield className="w-4 h-4 transition-transform group-hover:scale-110" />
                Run Bias Audit
              </Button>
              {error && (
                <p className="text-sm text-destructive mt-2">{error}</p>
              )}
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground animate-pulse">
                Running 4 name-variant tests... This may take ~30 seconds.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Status banner */}
              <div
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border",
                  result.flagged
                    ? "bg-destructive/5 border-destructive/20"
                    : "bg-accent/5 border-accent/20"
                )}
              >
                {result.flagged ? (
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" />
                )}
                <div>
                  <p
                    className={cn(
                      "font-medium text-sm",
                      result.flagged ? "text-destructive" : "text-accent"
                    )}
                  >
                    {result.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mean Score: {result.meanScore}% · Max Variance:{" "}
                    <span className={getVarianceColor(result.maxVariance)}>
                      {result.maxVariance} pts
                    </span>
                  </p>
                </div>
              </div>

              {/* Variants table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">
                        Name Variant
                      </th>
                      <th className="text-center p-3 font-medium text-muted-foreground">
                        ATS Score
                      </th>
                      <th className="text-center p-3 font-medium text-muted-foreground">
                        Variance from Mean
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.variants.map((v, i) => {
                      const variance =
                        v.atsScore >= 0
                          ? Math.abs(v.atsScore - result.meanScore)
                          : null;
                      return (
                        <tr
                          key={v.variant}
                          className={cn(
                            "border-t border-border transition-colors hover:bg-muted/30",
                            i % 2 === 0 ? "bg-background" : "bg-muted/10"
                          )}
                        >
                          <td className="p-3 font-medium text-foreground">
                            {v.variant}
                          </td>
                          <td className="p-3 text-center">
                            {v.atsScore >= 0 ? (
                              <span className="font-semibold tabular-nums">
                                {v.atsScore}%
                              </span>
                            ) : (
                              <span className="text-destructive text-xs">
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {variance !== null ? (
                              <span
                                className={cn(
                                  "font-mono text-xs px-2 py-1 rounded-md",
                                  variance > 5
                                    ? "bg-destructive/10 text-destructive"
                                    : variance > 2
                                    ? "bg-score-average/10 text-score-average"
                                    : "bg-accent/10 text-accent"
                                )}
                              >
                                ±{variance.toFixed(1)} pts
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Re-run button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunAudit}
                  disabled={isLoading}
                  className="gap-2"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Re-run Audit
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BiasAuditSection;
