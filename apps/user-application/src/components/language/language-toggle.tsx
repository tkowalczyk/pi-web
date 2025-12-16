import * as React from "react";
import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "./language-provider";
import { useTranslation } from "react-i18next";

interface LanguageToggleProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  align?: "start" | "center" | "end";
}

export function LanguageToggle({
  variant = "ghost",
  size = "default",
  align = "end",
}: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const languageOptions = [
    {
      value: "pl" as const,
      label: "Polski",
    },
    {
      value: "en" as const,
      label: "English",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="gap-2 hover:scale-105 active:scale-95 transition-all"
          aria-label={t("language.toggle")}
        >
          <Languages className="h-4 w-4" />
          <span className="text-sm font-medium uppercase">{language}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-48 p-2 bg-popover/95 backdrop-blur-sm"
      >
        {languageOptions.map((option) => {
          const isSelected = language === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setLanguage(option.value)}
              className={`
                flex items-center gap-3 px-3 py-2.5 cursor-pointer
                transition-all rounded-md
                ${isSelected ? "bg-accent/60" : ""}
              `}
            >
              <span className="flex-1 text-sm font-medium">{option.label}</span>
              {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
