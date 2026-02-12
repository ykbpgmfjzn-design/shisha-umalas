import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

const languages: { code: Language; flag: string; name: string }[] = [
  { code: "en", flag: "🇬🇧", name: "English" },
  { code: "ru", flag: "🇷🇺", name: "Русский" },
  { code: "id", flag: "🇮🇩", name: "Indonesia" },
  { code: "uk", flag: "🇺🇦", name: "Українська" },
  { code: "fr", flag: "🇫🇷", name: "Français" },
  { code: "hi", flag: "🇮🇳", name: "हिन्दी" },
  { code: "zh", flag: "🇨🇳", name: "中文" },
];

const StaffLanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const current = languages.find((l) => l.code === language);

  return (
    <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
      <SelectTrigger className="w-auto h-9 gap-1.5 border-border/40 bg-background/60 text-sm px-2.5">
        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span>{current?.flag}</span>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            <span className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default StaffLanguageSelector;
