export const WASTE_TYPE_MAP: Record<string, { pl: string; en: string }> = {
  "Bioodpady": { pl: "Bioodpady", en: "Bio Waste" },
  "Metale i tworzywa sztuczne": { pl: "Metale i tworzywa", en: "Metals & Plastics" },
  "Papier": { pl: "Papier", en: "Paper" },
  "Szkło": { pl: "Szkło", en: "Glass" },
  "Zmieszane - pozostałości po sortowaniu": { pl: "Zmieszane", en: "Mixed Waste" },
  "Odbiór naturalnych drzewek świątecznych (choinki)": { pl: "Choinki", en: "Christmas Trees" },
  "Odpady wielkogabarytowe, odzież, tekstylia, elektroodpady, zużyte opony": { pl: "Wielkogabarytowe", en: "Bulky Waste" },
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
  // Direct lookup
  if (WASTE_TYPE_MAP[name]) {
    return WASTE_TYPE_MAP[name][locale];
  }

  // Fallback: check partial matches for robustness
  const lowerName = name.toLowerCase();

  if (lowerName.includes("bioodpad")) {
    return locale === "en" ? "Bio Waste" : "Bioodpady";
  }
  if (lowerName.includes("metal") || lowerName.includes("tworzyw")) {
    return locale === "en" ? "Metals & Plastics" : "Metale i tworzywa";
  }
  if (lowerName.includes("papier")) {
    return locale === "en" ? "Paper" : "Papier";
  }
  if (lowerName.includes("szkło") || lowerName.includes("glass")) {
    return locale === "en" ? "Glass" : "Szkło";
  }
  if (lowerName.includes("zmieszane")) {
    return locale === "en" ? "Mixed Waste" : "Zmieszane";
  }
  if (lowerName.includes("choink")) {
    return locale === "en" ? "Christmas Trees" : "Choinki";
  }
  if (lowerName.includes("wielkogabaryt") || lowerName.includes("bulky")) {
    return locale === "en" ? "Bulky Waste" : "Wielkogabarytowe";
  }

  // Return original if no match
  return name;
}

export function translateMonth(month: string, locale: "pl" | "en"): string {
  return MONTH_MAP[month]?.[locale] || month;
}
