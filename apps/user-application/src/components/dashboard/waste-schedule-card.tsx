import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar } from "lucide-react";
import { getMyWasteSchedule } from "@/core/functions/waste";
import { useTranslation } from "react-i18next";
import { translateWasteType } from "@repo/data-ops/lib/enum-translations";

export function WasteScheduleCard() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language as "pl" | "en";

  const { data: schedules = [] } = useSuspenseQuery({
    queryKey: ["waste-schedule"],
    queryFn: () => getMyWasteSchedule(),
  });

  const upcomingCollections = getUpcomingCollections(schedules, t, locale);

  if (upcomingCollections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline">{t("waste_schedule.schedule")}</Badge>
          </div>
          <CardTitle>{t("waste_schedule.title")}</CardTitle>
          <CardDescription>
            {t("waste_schedule.noUpcoming")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="group hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Trash2 className="h-5 w-5 text-primary" />
          </div>
          <Badge variant="outline">{t("waste_schedule.nextTwoWeeks")}</Badge>
        </div>
        <CardTitle>{t("waste_schedule.title")}</CardTitle>
        <CardDescription>
          {t("waste_schedule.upcomingDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingCollections.map((collection, idx) => {
            const isToday = collection.daysUntil === 0;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  isToday
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted/50 hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground mb-1">
                      {collection.dateFormatted}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {collection.wasteTypes.map((type, typeIdx) => (
                        <Badge
                          key={typeIdx}
                          variant="outline"
                          className={`text-xs ${getWasteTypeColor(type)}`}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Badge variant={isToday ? "default" : "outline"}>
                  {isToday
                    ? t("waste_schedule.today")
                    : collection.daysUntil === 1
                    ? t("waste_schedule.tomorrow")
                    : `${collection.daysUntil}d`}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface UpcomingCollection {
  wasteTypes: string[];
  date: Date;
  dateFormatted: string;
  daysUntil: number;
}

function getUpcomingCollections(schedules: any[], t: any, locale: "pl" | "en"): UpcomingCollection[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(today.getDate() + 14);

  const collectionMap = new Map<string, { date: Date; wasteTypes: string[] }>();

  for (const schedule of schedules) {
    if (!schedule.month || !schedule.year) continue;

    const days = JSON.parse(schedule.days) as number[];
    const monthIndex = monthNameToIndex(schedule.month);

    for (const day of days) {
      const date = new Date(schedule.year, monthIndex, day);
      date.setHours(0, 0, 0, 0);

      if (date >= today && date <= twoWeeksFromNow) {
        const dateKey = date.toISOString().split('T')[0]!;

        if (!collectionMap.has(dateKey)) {
          collectionMap.set(dateKey, { date, wasteTypes: [] });
        }

        const translatedType = translateWasteType(schedule.wasteTypeName || "Unknown", locale);
        collectionMap.get(dateKey)!.wasteTypes.push(translatedType);
      }
    }
  }

  const collections: UpcomingCollection[] = Array.from(collectionMap.values()).map(item => {
    const daysUntil = Math.floor((item.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      wasteTypes: item.wasteTypes,
      date: item.date,
      dateFormatted: formatDate(item.date, t),
      daysUntil,
    };
  });

  return collections.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function monthNameToIndex(month: string): number {
  // Handle numeric month strings ("1", "2", ...) from new data format
  const numericMonth = parseInt(month, 10);
  if (!isNaN(numericMonth)) {
    return numericMonth - 1; // Convert to 0-based index
  }

  // Fallback: handle old month name format ("January", "February", ...)
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  return months.indexOf(month);
}

function formatDate(date: Date, t: any): string {
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const dayName = t(`waste_schedule.days.${dayKeys[date.getDay()]}`);
  const monthName = t(`waste_schedule.months.${monthKeys[date.getMonth()]}`);

  return `${dayName}, ${monthName} ${date.getDate()}`;
}

function getWasteTypeColor(wasteType: string): string {
  const type = wasteType.toLowerCase();

  // Bio - brown
  if (type.includes("bio")) {
    return "bg-amber-700 hover:bg-amber-800 text-white border-amber-800";
  }

  // Szkło/Glass - green
  if (type.includes("szkło") || type.includes("glass")) {
    return "bg-green-600 hover:bg-green-700 text-white border-green-700";
  }

  // Metale i tworzywa/Metals & Plastics - yellow
  if (type.includes("metal") || type.includes("tworzywa") || type.includes("plastik") || type.includes("plastic")) {
    return "bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600";
  }

  // Papier/Paper - blue
  if (type.includes("papier") || type.includes("paper")) {
    return "bg-blue-600 hover:bg-blue-700 text-white border-blue-700";
  }

  // Zmieszane/Mixed - default gray
  return "bg-gray-600 hover:bg-gray-700 text-white border-gray-700";
}
