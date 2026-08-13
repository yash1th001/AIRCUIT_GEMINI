import { FileText, Menu, LogOut, User, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./auth/UserMenu";
import { useAuth } from "@/hooks/use-auth";
import AuthModal from "./auth/AuthModal";
import ProfileSettingsDialog from "./profile/ProfileSettingsDialog";

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`w-full sticky top-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-card/90 backdrop-blur-lg border-b border-border shadow-card" 
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center shadow-card transition-all duration-300 group-hover:shadow-elevated group-hover:scale-105">
            <FileText className="w-5 h-5 text-primary-foreground transition-transform group-hover:rotate-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              AIcruit
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Smart Resume Analysis</p>
          </div>
        </a>
        
        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: "#analyzer", label: "Analyzer" },
            { href: "#guide", label: "Resume Guide" },
          ].map((link) => (
            <a 
              key={link.href}
              href={link.href} 
              className="relative text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary rounded-full transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          <div className="hidden md:block">
            <UserMenu />
          </div>
          
          {/* Mobile menu button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-card/95 backdrop-blur-lg border-b border-border shadow-elevated animate-slide-down">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {[
              { href: "#analyzer", label: "Analyzer" },
              { href: "#guide", label: "Resume Guide" },
            ].map((link) => (
              <a 
                key={link.href}
                href={link.href} 
                className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-3 rounded-lg transition-all"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            
            <div className="h-px bg-border my-2" />
            
            {/* Mobile Auth Actions */}
            {isLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : user ? (
              <div className="flex flex-col gap-2 px-2 py-1">
                <div className="text-xs text-muted-foreground px-4 py-2 bg-muted/30 rounded-lg mb-1 truncate">
                  Signed in as <span className="font-semibold text-foreground">{user.email}</span>
                </div>
                <ProfileSettingsDialog />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 px-2 py-1">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setAuthView("login");
                    setIsAuthModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </Button>
                <Button 
                  onClick={() => {
                    setAuthView("signup");
                    setIsAuthModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full justify-center"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultView={authView}
      />
    </header>
  );
};

export default Header;
