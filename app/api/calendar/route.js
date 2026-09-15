import { NextResponse } from "next/server";
import { getAuthenticatedMember } from "../../lib/auth-token";
import {
  createCalendarEvent,
  mutateCalendar,
  readCalendarState,
  updateCalendarEvent,
} from "../../lib/calendar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200, etag) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  if (etag) response.headers.set("ETag", etag);
  return response;
}

async function requireAuth(request) {
  return getAuthenticatedMember(request);
}

export async function GET(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const currentEtag = request.headers.get("if-none-match") || undefined;
    const result = await readCalendarState({ ifNoneMatch: currentEtag });

    if (result.notModified) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.etag,
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    }

    return json({ events: result.state.events }, 200, result.etag);
  } catch (error) {
    console.error("GET /api/calendar", error);
    return json({ error: "Unable to load calendar events." }, 500);
  }
}

export async function POST(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const event = createCalendarEvent(body.data || body);
    const result = await mutateCalendar((events) => [...events, event]);
    return json({ events: result.state.events, event }, 201, result.etag);
  } catch (error) {
    console.error("POST /api/calendar", error);
    return json({ error: error.message || "Unable to create event." }, 400);
  }
}

export async function PATCH(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return json({ error: "Event ID is required." }, 400);

    let updated = null;
    const result = await mutateCalendar((events) => {
      const index = events.findIndex((event) => event.id === id);
      if (index < 0) throw new Error("Event not found.");
      updated = updateCalendarEvent(events[index], body.data || {});
      const next = [...events];
      next[index] = updated;
      return next;
    });

    return json({ events: result.state.events, event: updated }, 200, result.etag);
  } catch (error) {
    console.error("PATCH /api/calendar", error);
    return json({ error: error.message || "Unable to update event." }, 400);
  }
}

export async function DELETE(request) {
  try {
    const actor = await requireAuth(request);
    if (!actor) return json({ error: "Unauthorized." }, 401);

    const body = await request.json();
    const id = String(body.id || "");
    if (!id) return json({ error: "Event ID is required." }, 400);

    const result = await mutateCalendar((events) => {
      if (!events.some((event) => event.id === id)) throw new Error("Event not found.");
      return events.filter((event) => event.id !== id);
    });

    return json({ events: result.state.events }, 200, result.etag);
  } catch (error) {
    console.error("DELETE /api/calendar", error);
    return json({ error: error.message || "Unable to delete event." }, 400);
  }
}
