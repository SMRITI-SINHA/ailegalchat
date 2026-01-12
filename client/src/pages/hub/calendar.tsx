import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  RefreshCw,
  CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { SiGoogle } from "react-icons/si";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { CalendarEvent } from "@shared/schema";

const USER_ID = "default-user";

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

interface GoogleCalendarStatus {
  connected: boolean;
  isExpired?: boolean;
  lastSyncAt?: string;
  calendarId?: string;
}

export default function LegalCalendarPage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    type: "professional",
    isHighPriority: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "google") {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      window.history.replaceState({}, "", "/hub/calendar");
    }
    if (params.get("error")) {
      console.error("OAuth error:", params.get("error"));
      window.history.replaceState({}, "", "/hub/calendar");
    }
  }, [queryClient]);

  const { data: googleStatus, isLoading: statusLoading } = useQuery<GoogleCalendarStatus>({
    queryKey: ["/api/calendar/google/status", USER_ID],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/google/status?userId=${USER_ID}`);
      return res.json();
    },
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar/events", USER_ID],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/events?userId=${USER_ID}`);
      return res.json();
    },
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/google/auth-url?userId=${USER_ID}`);
      const data = await res.json();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calendar/google/disconnect", { userId: USER_ID });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status", USER_ID] });
      setSyncDialogOpen(false);
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calendar/google/sync", { userId: USER_ID });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events", USER_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/google/status", USER_ID] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: typeof newEvent) => {
      return apiRequest("POST", "/api/calendar/events", {
        userId: USER_ID,
        title: eventData.title,
        description: eventData.description || null,
        startTime: new Date(eventData.startTime).toISOString(),
        endTime: new Date(eventData.endTime).toISOString(),
        type: eventData.type,
        isHighPriority: eventData.isHighPriority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events", USER_ID] });
      setCreateEventOpen(false);
      setNewEvent({
        title: "",
        description: "",
        startTime: "",
        endTime: "",
        type: "professional",
        isHighPriority: false,
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return apiRequest("DELETE", `/api/calendar/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events", USER_ID] });
    },
  });

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const eventsForDate = (date: Date) => {
    return events.filter((e) => isSameDay(new Date(e.startTime), date));
  };

  const selectedDateEvents = eventsForDate(selectedDate);

  const upcomingEvents = events
    .filter((e) => new Date(e.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const thisWeekEvents = events.filter(
    (e) => new Date(e.startTime) >= thisWeekStart && new Date(e.startTime) <= thisWeekEnd
  );
  const academicEventsCount = thisWeekEvents.filter((e) => e.type === "academic").length;
  const highPriorityCount = thisWeekEvents.filter((e) => e.isHighPriority).length;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleConnectGoogle = () => {
    connectGoogleMutation.mutate();
  };

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.startTime || !newEvent.endTime) return;
    createEventMutation.mutate(newEvent);
  };

  const openCreateEvent = (date?: Date) => {
    const d = date || selectedDate;
    const startStr = format(d, "yyyy-MM-dd'T'09:00");
    const endStr = format(d, "yyyy-MM-dd'T'10:00");
    setNewEvent({
      ...newEvent,
      startTime: startStr,
      endTime: endStr,
    });
    setCreateEventOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Legal Academic Calendar</h1>
          <p className="text-muted-foreground">
            Sync your personal, institutional & legal ecosystem timelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => openCreateEvent()}
            className="gap-2"
            data-testid="button-create-event"
          >
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
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

      {googleStatus?.connected && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-sm text-muted-foreground">Connected:</span>
          <Badge variant="outline" className="gap-1">
            <SiGoogle className="h-3 w-3" />
            Google Calendar
            {googleStatus.isExpired && (
              <AlertCircle className="h-3 w-3 text-amber-500 ml-1" />
            )}
          </Badge>
          {googleStatus.lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              Last synced: {format(new Date(googleStatus.lastSyncAt), "MMM d, h:mm a")}
            </span>
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
              <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
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
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
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
                            className={`h-1.5 w-1.5 rounded-full ${eventTypeDots[event.type] || eventTypeDots.professional}`}
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
                  <span className="text-xs text-muted-foreground capitalize">{type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-medium">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => openCreateEvent(selectedDate)}
                data-testid="button-add-event-date"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {selectedDateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No events scheduled</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreateEvent(selectedDate)}
                    className="mt-2 text-primary"
                  >
                    Add an event
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-2 rounded-md flex items-center justify-between gap-2 ${eventTypeColors[event.type] || eventTypeColors.professional}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs opacity-75">
                          {format(new Date(event.startTime), "h:mm a")} -{" "}
                          {format(new Date(event.endTime), "h:mm a")}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-60 hover:opacity-100"
                        onClick={() => deleteEventMutation.mutate(event.id)}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming events
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${eventTypeDots[event.type] || eventTypeDots.professional}`}
                        />
                        <span className="text-sm">{event.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.startTime), "MMM d")}
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
              Connect your calendar to enable bidirectional sync. Events created in
              Chakshi will sync to Google Calendar and vice versa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {googleStatus?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-white border">
                      <SiGoogle className="h-5 w-5 text-[#4285F4]" />
                    </div>
                    <div>
                      <p className="font-medium">Google Calendar</p>
                      <p className="text-xs text-muted-foreground">Connected</p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    data-testid="button-sync-now"
                  >
                    {syncMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => disconnectGoogleMutation.mutate()}
                    disabled={disconnectGoogleMutation.isPending}
                    data-testid="button-disconnect-google"
                  >
                    Disconnect
                  </Button>
                </div>

                {googleStatus.lastSyncAt && (
                  <p className="text-xs text-muted-foreground text-center">
                    Last synced: {format(new Date(googleStatus.lastSyncAt), "PPpp")}
                  </p>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-14"
                onClick={handleConnectGoogle}
                disabled={connectGoogleMutation.isPending}
                data-testid="button-connect-google"
              >
                {connectGoogleMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="p-2 rounded-md bg-white border">
                    <SiGoogle className="h-5 w-5 text-[#4285F4]" />
                  </div>
                )}
                <div className="text-left">
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">
                    Connect your Google account
                  </p>
                </div>
              </Button>
            )}

            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Your calendar data is encrypted and never shared with third parties.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>
              Add a new event to your calendar. It will sync to Google Calendar if connected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                data-testid="input-event-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description (optional)</Label>
              <Textarea
                id="event-description"
                placeholder="Event description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                data-testid="input-event-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-start">Start</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  data-testid="input-event-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">End</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  data-testid="input-event-end"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select
                value={newEvent.type}
                onValueChange={(value) => setNewEvent({ ...newEvent, type: value })}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="exam">Exam</SelectItem>
                  <SelectItem value="career">Career</SelectItem>
                  <SelectItem value="court">Court</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="high-priority"
                checked={newEvent.isHighPriority}
                onChange={(e) => setNewEvent({ ...newEvent, isHighPriority: e.target.checked })}
                className="rounded"
                data-testid="checkbox-high-priority"
              />
              <Label htmlFor="high-priority" className="text-sm">
                Mark as high priority
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleCreateEvent}
                disabled={createEventMutation.isPending || !newEvent.title}
                data-testid="button-save-event"
              >
                {createEventMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create Event
              </Button>
              <Button variant="outline" onClick={() => setCreateEventOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
