import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, MessageCircle, X, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { AnalysisResult } from "./AnalyzerSection";
import { getApiBaseUrl } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ResumeChatProps {
  resumeText: string;
  jobDescription: string;
  analysisResults: AnalysisResult;
}

const ResumeChat = ({ resumeText, jobDescription, analysisResults }: ResumeChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const backendUrl = getApiBaseUrl();
      const response = await fetch(`${backendUrl || "/api"}/analyze-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: `User question: ${userMessage}\n\nResume context:\n${resumeText.slice(0, 3000)}`,
          jobDescription: jobDescription || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Backend unavailable');
      }

      const data = await response.json();
      const reply = `Based on your resume analysis (ATS: ${analysisResults.atsScore}%):\n\n` +
        (data.suggestions?.improvements?.[0] || "Please review the analysis results above for detailed feedback.");
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (error) {
      // Fallback: give a static helpful message
      const fallback = `I can see your resume has an ATS score of ${analysisResults.atsScore}% and structure score of ${analysisResults.structureScore}%. ` +
        `Key suggestions: ${analysisResults.suggestions.improvements[0] || 'Refer to the analysis above.'}`;
      setMessages(prev => [...prev, { role: "assistant", content: fallback }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "Why is my ATS score low?",
    "What's the most important change to make?",
    "How do I add the missing keywords?",
    "Explain the structure suggestions",
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-elevated hover:shadow-lg transition-all duration-300 gradient-hero z-50 group"
        size="icon"
      >
        <MessageCircle className="h-6 w-6 text-primary-foreground transition-transform group-hover:scale-110" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[380px] h-[520px] flex flex-col shadow-elevated border-border z-50 animate-scale-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-hero flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Resume Assistant</h3>
            <p className="text-xs text-muted-foreground">Ask about your analysis</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(false)}
          className="h-8 w-8 rounded-lg hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-2xl rounded-tl-md p-3 text-sm text-foreground">
                Hi! I'm here to help you understand your analysis results and improve your resume. What would you like to know?
              </div>
            </div>
            
            <div className="space-y-2 mt-4">
              <p className="text-xs text-muted-foreground font-medium px-1">Suggested questions:</p>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => sendMessage(), 100);
                  }}
                  className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  msg.role === "user" ? "bg-primary/10" : "bg-primary/10"
                )}>
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-primary" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className={cn(
                  "rounded-2xl p-3 text-sm max-w-[85%]",
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-md" 
                    : "bg-muted/50 text-foreground rounded-tl-md"
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted/50 rounded-2xl rounded-tl-md p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your resume..."
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ResumeChat;
