import { storage } from "./storage";
import type { CalendarEvent, InsertCalendarEvent } from "@shared/schema";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

let dynamicRedirectUri = "";

export function setRedirectUri(uri: string) {
  dynamicRedirectUri = uri;
}

export function getRedirectUri(): string {
  return dynamicRedirectUri;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status?: string;
  updated?: string;
}

export interface GoogleCalendarListResponse {
  items: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

export class GoogleCalendarService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  static getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    return response.json();
  }

  async refreshAccessToken(): Promise<string> {
    const creds = await storage.getGoogleCalendarCredentials(this.userId);
    if (!creds) {
      throw new Error("No Google Calendar credentials found");
    }

    if (new Date(creds.tokenExpiry) > new Date(Date.now() + 5 * 60 * 1000)) {
      return creds.accessToken;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: creds.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const tokens: GoogleTokens = await response.json();
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

    await storage.updateGoogleCalendarCredentials(this.userId, {
      accessToken: tokens.access_token,
      tokenExpiry: newExpiry,
    });

    return tokens.access_token;
  }

  async createGoogleEvent(event: CalendarEvent): Promise<GoogleCalendarEvent | null> {
    try {
      const accessToken = await this.refreshAccessToken();
      const creds = await storage.getGoogleCalendarCredentials(this.userId);
      const calendarId = creds?.calendarId || "primary";

      const googleEvent = {
        summary: event.title,
        description: event.description || undefined,
        start: { dateTime: new Date(event.startTime).toISOString() },
        end: { dateTime: new Date(event.endTime).toISOString() },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleEvent),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to create Google event:", error);
        return null;
      }

      const createdEvent: GoogleCalendarEvent = await response.json();
      
      await storage.updateCalendarEvent(event.id, {
        googleEventId: createdEvent.id,
        syncStatus: "synced",
      });

      return createdEvent;
    } catch (error) {
      console.error("Error creating Google event:", error);
      await storage.updateCalendarEvent(event.id, { syncStatus: "failed" });
      return null;
    }
  }

  async updateGoogleEvent(event: CalendarEvent): Promise<GoogleCalendarEvent | null> {
    if (!event.googleEventId) {
      return this.createGoogleEvent(event);
    }

    try {
      const accessToken = await this.refreshAccessToken();
      const creds = await storage.getGoogleCalendarCredentials(this.userId);
      const calendarId = creds?.calendarId || "primary";

      const googleEvent = {
        summary: event.title,
        description: event.description || undefined,
        start: { dateTime: new Date(event.startTime).toISOString() },
        end: { dateTime: new Date(event.endTime).toISOString() },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${event.googleEventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleEvent),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to update Google event:", error);
        return null;
      }

      const updatedEvent: GoogleCalendarEvent = await response.json();
      await storage.updateCalendarEvent(event.id, { syncStatus: "synced" });

      return updatedEvent;
    } catch (error) {
      console.error("Error updating Google event:", error);
      await storage.updateCalendarEvent(event.id, { syncStatus: "failed" });
      return null;
    }
  }

  async deleteGoogleEvent(googleEventId: string): Promise<boolean> {
    try {
      const accessToken = await this.refreshAccessToken();
      const creds = await storage.getGoogleCalendarCredentials(this.userId);
      const calendarId = creds?.calendarId || "primary";

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${googleEventId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      return response.ok || response.status === 404;
    } catch (error) {
      console.error("Error deleting Google event:", error);
      return false;
    }
  }

  async syncFromGoogle(): Promise<{ added: number; updated: number; deleted: number }> {
    const result = { added: 0, updated: 0, deleted: 0 };

    try {
      const accessToken = await this.refreshAccessToken();
      const creds = await storage.getGoogleCalendarCredentials(this.userId);
      const calendarId = creds?.calendarId || "primary";

      const params = new URLSearchParams({
        maxResults: "250",
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (creds?.syncToken) {
        params.set("syncToken", creds.syncToken);
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.status === 410) {
        await storage.updateGoogleCalendarCredentials(this.userId, { syncToken: null });
        return this.syncFromGoogle();
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch events: ${error}`);
      }

      const data: GoogleCalendarListResponse = await response.json();

      for (const googleEvent of data.items) {
        const existingEvent = await storage.getCalendarEventByGoogleId(googleEvent.id);

        if (googleEvent.status === "cancelled") {
          if (existingEvent) {
            await storage.deleteCalendarEvent(existingEvent.id);
            result.deleted++;
          }
          continue;
        }

        const startTime = googleEvent.start.dateTime
          ? new Date(googleEvent.start.dateTime)
          : new Date(googleEvent.start.date + "T00:00:00");
        const endTime = googleEvent.end.dateTime
          ? new Date(googleEvent.end.dateTime)
          : new Date(googleEvent.end.date + "T23:59:59");

        if (existingEvent) {
          await storage.updateCalendarEvent(existingEvent.id, {
            title: googleEvent.summary || "Untitled",
            description: googleEvent.description || null,
            startTime,
            endTime,
            syncStatus: "synced",
          });
          result.updated++;
        } else {
          const newEvent: InsertCalendarEvent = {
            userId: this.userId,
            title: googleEvent.summary || "Untitled",
            description: googleEvent.description || null,
            startTime,
            endTime,
            type: "professional",
            googleEventId: googleEvent.id,
            syncStatus: "synced",
          };
          await storage.createCalendarEvent(newEvent);
          result.added++;
        }
      }

      if (data.nextSyncToken) {
        await storage.updateGoogleCalendarCredentials(this.userId, {
          syncToken: data.nextSyncToken,
          lastSyncAt: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error("Error syncing from Google:", error);
      throw error;
    }
  }

  async syncToGoogle(): Promise<{ synced: number; failed: number }> {
    const result = { synced: 0, failed: 0 };

    try {
      const events = await storage.getCalendarEvents(this.userId);
      const pendingEvents = events.filter((e) => e.syncStatus === "pending");

      for (const event of pendingEvents) {
        const googleEvent = await this.createGoogleEvent(event);
        if (googleEvent) {
          result.synced++;
        } else {
          result.failed++;
        }
      }

      return result;
    } catch (error) {
      console.error("Error syncing to Google:", error);
      throw error;
    }
  }

  async fullSync(): Promise<{
    fromGoogle: { added: number; updated: number; deleted: number };
    toGoogle: { synced: number; failed: number };
  }> {
    const toGoogle = await this.syncToGoogle();
    const fromGoogle = await this.syncFromGoogle();
    return { fromGoogle, toGoogle };
  }
}
