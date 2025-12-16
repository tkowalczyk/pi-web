import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme";
import { LanguageToggle } from "@/components/language/language-toggle";
import { useTranslation } from "react-i18next";

export function LandingNav() {
  const { t } = useTranslation();
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
        isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-primary/5"
          : "bg-transparent",
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="group flex items-center space-x-2 no-underline"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
              {t("nav.appName")}
            </span>
          </Link>

          {/* Toggles */}
          <div className="flex items-center space-x-2">
            <LanguageToggle variant="ghost" align="end" />
            <ThemeToggle variant="ghost" align="end" />
          </div>
        </div>
      </div>
    </nav>
  );
}
