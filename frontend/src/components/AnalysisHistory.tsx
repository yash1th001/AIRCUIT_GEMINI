import { useState, useEffect } from "react";
import { History, Trash2, Eye, Calendar, Target, FileText, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { AnalysisResult } from "./AnalyzerSection";
import ScoreCircle from "./ScoreCircle";

interface AnalysisRecord {
  id: string;
  resume_text: string;
  job_description: string | null;
  ats_score: number;
  jd_match_score: number | null;
  structure_score: number;
  suggestions: AnalysisResult["suggestions"];
  structure_analysis: AnalysisResult["structureAnalysis"] | null;
  candidate_context: AnalysisResult["candidateContext"] | null;
  created_at: string;
}

interface AnalysisHistoryProps {
  onLoadAnalysis: (result: AnalysisResult, resumeText: string, jobDescription: string) => void;
}

const AnalysisHistory = ({ onLoadAnalysis }: AnalysisHistoryProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const storageKey = `aicruit_history_${user.id}`;
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      setHistory(stored as AnalysisRecord[]);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchHistory();
    }
  }, [isOpen, user]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      if (!user) return;
      const storageKey = `aicruit_history_${user.id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const updated = existing.filter((item: AnalysisRecord) => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setHistory(updated);
      toast({
        title: "Analysis deleted",
        description: "The analysis has been removed from your history.",
      });
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: "Delete failed",
        description: "Could not delete the analysis.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoad = (record: AnalysisRecord) => {
    const result: AnalysisResult = {
      atsScore: record.ats_score,
      jdMatchScore: record.jd_match_score ?? undefined,
      structureScore: record.structure_score,
      hasJobDescription: !!record.job_description,
      suggestions: record.suggestions,
      structureAnalysis: record.structure_analysis ?? {
        sections: [],
        formatting: [],
      },
      candidateContext: record.candidate_context ?? undefined,
    };

    onLoadAnalysis(result, record.resume_text, record.job_description || "");
    setIsOpen(false);
    
    toast({
      title: "Analysis loaded",
      description: "Viewing your previous analysis results.",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (!user) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <History className="h-4 w-4" />
        History
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Analysis History
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No analysis history yet.</p>
              <p className="text-sm text-muted-foreground/70">
                Your resume analyses will appear here.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-3">
                {history.map((record) => (
                  <Card
                    key={record.id}
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <ScoreCircle 
                          score={record.ats_score} 
                          size="sm" 
                          label="ATS"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(record.created_at)}
                        </div>
                        
                        <div className="flex flex-wrap gap-3 text-sm">
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
                            <Target className="h-3.5 w-3.5 text-primary" />
                            ATS: {record.ats_score}%
                          </span>
                          {record.jd_match_score !== null && (
                            <span className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
                              <Target className="h-3.5 w-3.5 text-accent" />
                              JD Match: {record.jd_match_score}%
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
                            Structure: {record.structure_score}%
                          </span>
                        </div>
                        
                        {record.job_description && (
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            JD: {record.job_description.substring(0, 80)}...
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleLoad(record)}
                          title="View analysis"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          disabled={deletingId === record.id}
                          className="text-destructive hover:text-destructive"
                          title="Delete analysis"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnalysisHistory;
