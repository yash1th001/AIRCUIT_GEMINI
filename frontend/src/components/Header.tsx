import { ArrowUpRight, FileText, Menu, LogOut, Loader2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./auth/UserMenu";
import { useAuth } from "@/hooks/use-auth";
import ProfileSettingsDialog from "./profile/ProfileSettingsDialog";
import { toast } from "@/hooks/use-toast";

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, signOut } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        scrolled
          ? "border-border/80 bg-background/85 shadow-card backdrop-blur-xl"
          : "border-transparent bg-background/70 backdrop-blur-md"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link to="/" className="group flex items-center gap-2.5 min-w-0 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary leading-none">
              AIcruit
            </h1>
            <p className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:block">
              Resume intelligence
            </p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 rounded-full border border-border/80 bg-card/70 p-1 md:flex">
          {[
            { href: "/", label: "Home" },
            { href: "/analyze", label: "Analyzer" },
            ...(user ? [{ href: "/history", label: "History" }] : []),
            { href: "/guide", label: "Resume Guide" },
          ].map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                location.pathname === link.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />

          {/* Desktop-only: UserMenu + Get started */}
          <div className="hidden md:block">
            <UserMenu />
          </div>
          <Link
            to="/analyze"
            className="hidden items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 md:flex"
          >
            Get started
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          {/* Mobile hamburger — only on < md */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-border bg-card/95 shadow-elevated backdrop-blur-xl md:hidden animate-slide-down">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {[
              { href: "/", label: "Home" },
              { href: "/analyze", label: "Analyzer" },
              ...(user ? [{ href: "/history", label: "History" }] : []),
              { href: "/guide", label: "Resume Guide" },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                  location.pathname === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
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
                  onClick={async () => {
                    try {
                      await signOut();
                      setMobileMenuOpen(false);
                    } catch (error) {
                      toast({ title: "Sign out failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
                    }
                  }}
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 px-2 py-1">
                <Link
                  to="/auth"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth?next=%2Fanalyze"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
                >
                  Get started
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
