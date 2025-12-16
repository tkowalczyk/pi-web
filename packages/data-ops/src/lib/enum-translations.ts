export const WASTE_TYPE_MAP: Record<string, { pl: string; en: string }> = {
  "Bio": { pl: "Bio", en: "Bio" },
  "Plastik": { pl: "Plastik", en: "Plastic" },
  "Papier": { pl: "Papier", en: "Paper" },
  "Szkło": { pl: "Szkło", en: "Glass" },
  "Zmieszane": { pl: "Zmieszane", en: "Mixed Waste" },
};

export const MONTH_MAP: Record<string, { pl: string; en: string }> = {
  "styczeń": { pl: "Styczeń", en: "January" },
  "luty": { pl: "Luty", en: "February" },
  "marzec": { pl: "Marzec", en: "March" },
  "kwiecień": { pl: "Kwiecień", en: "April" },
  "maj": { pl: "Maj", en: "May" },
  "czerwiec": { pl: "Czerwiec", en: "June" },
  "lipiec": { pl: "Lipiec", en: "July" },
  "sierpień": { pl: "Sierpień", en: "August" },
  "wrzesień": { pl: "Wrzesień", en: "September" },
  "październik": { pl: "Październik", en: "October" },
  "listopad": { pl: "Listopad", en: "November" },
  "grudzień": { pl: "Grudzień", en: "December" },
};

export function translateWasteType(name: string, locale: "pl" | "en"): string {
  return WASTE_TYPE_MAP[name]?.[locale] || name;
}

export function translateMonth(month: string, locale: "pl" | "en"): string {
  return MONTH_MAP[month]?.[locale] || month;
}
