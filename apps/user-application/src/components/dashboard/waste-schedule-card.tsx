import { useSuspenseQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar } from "lucide-react";
import { getMyWasteSchedule } from "@/core/functions/waste";

export function WasteScheduleCard() {
  const { data: schedules = [] } = useSuspenseQuery({
    queryKey: ["waste-schedule"],
    queryFn: () => getMyWasteSchedule(),
  });

  const upcomingCollections = getUpcomingCollections(schedules);

  if (upcomingCollections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline">Schedule</Badge>
          </div>
          <CardTitle>Waste Collection</CardTitle>
          <CardDescription>
            No upcoming collections in next 2 weeks
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
          <Badge variant="outline">Next 2 Weeks</Badge>
        </div>
        <CardTitle>Waste Collection</CardTitle>
        <CardDescription>
          Upcoming collections for notification address
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
                          variant={isToday ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Badge variant={isToday ? "default" : "outline"}>
                  {isToday
                    ? "Today"
                    : collection.daysUntil === 1
                    ? "Tomorrow"
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

function getUpcomingCollections(schedules: any[]): UpcomingCollection[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksFromNow = new Date(today);
  twoWeeksFromNow.setDate(today.getDate() + 14);

  const collectionMap = new Map<string, { date: Date; wasteTypes: string[] }>();

  for (const schedule of schedules) {
    const days = JSON.parse(schedule.days) as number[];
    const monthIndex = monthNameToIndex(schedule.month);

    for (const day of days) {
      const date = new Date(schedule.year, monthIndex, day);
      date.setHours(0, 0, 0, 0);

      if (date >= today && date <= twoWeeksFromNow) {
        const dateKey = date.toISOString().split('T')[0];

        if (!collectionMap.has(dateKey)) {
          collectionMap.set(dateKey, { date, wasteTypes: [] });
        }

        collectionMap.get(dateKey)!.wasteTypes.push(schedule.wasteTypeName || "Unknown");
      }
    }
  }

  const collections: UpcomingCollection[] = Array.from(collectionMap.values()).map(item => {
    const daysUntil = Math.floor((item.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      wasteTypes: item.wasteTypes,
      date: item.date,
      dateFormatted: formatDate(item.date),
      daysUntil,
    };
  });

  return collections.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function monthNameToIndex(month: string): number {
  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];
  return months.indexOf(month);
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}
