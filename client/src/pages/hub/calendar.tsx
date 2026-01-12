import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  RefreshCw,
  CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "academic" | "exam" | "career" | "court" | "professional";
  isHighPriority?: boolean;
}

const eventTypeColors: Record<string, string> = {
  academic: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  exam: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  career: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  court: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  professional: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const eventTypeDots: Record<string, string> = {
  academic: "bg-amber-500",
  exam: "bg-rose-500",
  career: "bg-emerald-500",
  court: "bg-blue-500",
  professional: "bg-purple-500",
};

export default function LegalCalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [connectedCalendars, setConnectedCalendars] = useState<string[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const eventsForDate = (date: Date) => {
    return events.filter((e) => isSameDay(e.date, date));
  };

  const selectedDateEvents = eventsForDate(selectedDate);

  const upcomingEvents = events
    .filter((e) => e.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);

  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const thisWeekEvents = events.filter(
    (e) => e.date >= thisWeekStart && e.date <= thisWeekEnd
  );
  const academicEventsCount = thisWeekEvents.filter(
    (e) => e.type === "academic"
  ).length;
  const highPriorityCount = thisWeekEvents.filter(
    (e) => e.isHighPriority
  ).length;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleConnectGoogle = () => {
    if (!connectedCalendars.includes("google")) {
      setConnectedCalendars([...connectedCalendars, "google"]);
    }
    setSyncDialogOpen(false);
  };

  const handleConnectOutlook = () => {
    if (!connectedCalendars.includes("outlook")) {
      setConnectedCalendars([...connectedCalendars, "outlook"]);
    }
    setSyncDialogOpen(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Legal Academic Calendar</h1>
          <p className="text-muted-foreground">
            Sync your personal, institutional & legal ecosystem timelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSyncDialogOpen(true)}
            className="gap-2"
            data-testid="button-sync-calendar"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Calendar
          </Button>
        </div>
      </div>

      {connectedCalendars.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Connected:</span>
          {connectedCalendars.includes("google") && (
            <Badge variant="outline" className="gap-1">
              <SiGoogle className="h-3 w-3" />
              Google Calendar
            </Badge>
          )}
          {connectedCalendars.includes("outlook") && (
            <Badge variant="outline" className="gap-1">
              <svg className="h-3 w-3" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Outlook
            </Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePreviousMonth}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-semibold">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {allDays.map((day) => {
                const dayEvents = eventsForDate(day);
                const isCurrentMonth =
                  day.getMonth() === currentMonth.getMonth();
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      relative p-2 h-16 rounded-md text-sm transition-colors
                      ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                      ${isSelected ? "bg-primary/10 ring-2 ring-primary" : "hover-elevate"}
                      ${isTodayDate && !isSelected ? "bg-accent" : ""}
                    `}
                    data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <span
                      className={`
                        ${isTodayDate ? "font-bold" : ""}
                        ${isSelected ? "text-primary font-semibold" : ""}
                      `}
                    >
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <div
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full ${eventTypeDots[event.type]}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap">
              {Object.entries(eventTypeDots).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-xs text-muted-foreground capitalize">
                    {type}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No events scheduled for this date
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Perfect time for focused study
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-2 rounded-md ${eventTypeColors[event.type]}`}
                    >
                      <p className="text-sm font-medium">{event.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming events scheduled
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${eventTypeDots[event.type]}`}
                        />
                        <span className="text-sm">{event.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(event.date, "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {academicEventsCount || thisWeekEvents.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {academicEventsCount > 0 ? "Academic Events" : "Total Events"}
                  </p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {highPriorityCount}
                  </p>
                  <p className="text-xs text-muted-foreground">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Sync Your Calendar
            </DialogTitle>
            <DialogDescription>
              Connect your calendar to sync events with Chakshi. Your events
              will be visible in the Legal Academic Calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={handleConnectGoogle}
              data-testid="button-connect-google"
            >
              <div className="p-2 rounded-md bg-white border">
                <SiGoogle className="h-5 w-5 text-[#4285F4]" />
              </div>
              <div className="text-left">
                <p className="font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">
                  Connect your Google account
                </p>
              </div>
              {connectedCalendars.includes("google") && (
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={handleConnectOutlook}
              data-testid="button-connect-outlook"
            >
              <div className="p-2 rounded-md bg-white border">
                <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium">Outlook Calendar</p>
                <p className="text-xs text-muted-foreground">
                  Connect your Microsoft account
                </p>
              </div>
              {connectedCalendars.includes("outlook") && (
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
              )}
            </Button>

            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Your calendar data is encrypted and never shared with third
                parties.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
