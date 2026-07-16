import { FileText, Github, Linkedin, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center transition-all duration-300 group-hover:shadow-elevated group-hover:scale-105">
              <FileText className="w-5 h-5 text-primary-foreground transition-transform group-hover:rotate-6" />
            </div>
            <div>
              <p className="font-display font-bold text-lg group-hover:text-primary transition-colors">AIcruit</p>
              <p className="text-sm text-muted-foreground">Smart Resume Analysis</p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            {[
              { icon: Github, href: "#", label: "GitHub" },
              { icon: Twitter, href: "#", label: "Twitter" },
              { icon: Linkedin, href: "#", label: "LinkedIn" },
            ].map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="w-10 h-10 rounded-xl bg-muted/20 hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1"
              >
                <social.icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} AIcruit. All rights reserved.</p>
            <div className="flex items-center gap-6">
              {["Privacy Policy", "Terms of Service", "Contact"].map((link) => (
                <a 
                  key={link}
                  href="#" 
                  className="hover:text-secondary-foreground transition-colors relative group"
                >
                  {link}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;