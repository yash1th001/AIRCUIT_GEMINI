import { useState } from "react";
import { Lock, User, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import AuthModal from "./auth/AuthModal";

const LoginPrompt = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");

  return (
    <>
      <Card className="max-w-lg mx-auto p-8 text-center border-dashed">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <h3 className="font-display text-2xl font-bold text-foreground mb-3">
          Sign in to Analyze
        </h3>

        <p className="text-muted-foreground mb-6">
          Create a free account to analyze your resume and track your improvement over time.
        </p>

        <div className="space-y-3 text-sm text-muted-foreground mb-8">
          <div className="flex items-center gap-3 justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>AI-powered resume analysis</span>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <User className="w-4 h-4 text-primary" />
            <span>Save and track your history</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="hero"
            size="lg"
            onClick={() => {
              setAuthView("login");
              setIsAuthModalOpen(true);
            }}
            className="gap-2"
          >
            <User className="w-4 h-4" />
            Sign In
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setAuthView("signup");
              setIsAuthModalOpen(true);
            }}
          >
            Create Account
          </Button>
        </div>
      </Card>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultView={authView}
      />
    </>
  );
};

export default LoginPrompt;
