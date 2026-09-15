import { NextResponse } from "next/server";

function buildMiniCalendar(date = new Date(), events = []) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const monthName = date.toLocaleString("en-US", { month: "long" });

  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const eventDays = new Set(
    events.map((event) => new Date(event.start).getDate())
  );

  let calendar = `${monthName} ${year}\n\n`;
  calendar += "Su Mo Tu We Th Fr Sa\n";

  let row = "";

  for (let i = 0; i < firstDay; i++) {
    row += "   ";
  }

  for (let day = 1; day <= days; day++) {
    const current = new Date(year, month, day);

    let marker = String(day).padStart(2, " ");

    if (
      current.getDate() === today.getDate() &&
      current.getMonth() === today.getMonth() &&
      current.getFullYear() === today.getFullYear()
    ) {
      marker = `🔴${day}`;
    } else if (eventDays.has(day)) {
      marker = `•${day}`;
    }

    row += marker.padStart(3, " ");

    if ((firstDay + day) % 7 === 0) {
      calendar += row + "\n";
      row = "";
    }
  }

  if (row) calendar += row;

  return calendar;
}

export async function POST(request) {
  try {
    const webhook = process.env.LARK_CALENDAR_BOT_WEBHOOK;

    if (!webhook) {
      return NextResponse.json(
        { error: "Missing LARK_CALENDAR_BOT_WEBHOOK" },
        { status: 500 }
      );
    }

    const { events = [] } = await request.json();

    const now = new Date();

    const miniCalendar = buildMiniCalendar(now, events);

    const todayEvents = events.length
      ? events
          .map((event) => {
            const start = new Date(event.start);

            return `• ${start.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })} — ${event.title}`;
          })
          .join("\n")
      : "No scheduled events today.";

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        msg_type: "interactive",
        card: {
          header: {
            title: {
              tag: "plain_text",
              content: "📅 SDC Creative Calendar",
            },
          },
          elements: [
            {
              tag: "div",
              text: {
                tag: "lark_md",
                content:
                  `\`\`\`\n${miniCalendar}\n\`\`\`\n` +
                  `**📌 Today's Schedule**\n\n${todayEvents}`,
              },
            },
          ],
        },
      }),
    });

    const result = await response.json().catch(() => ({}));

    return NextResponse.json({
      ok: response.ok,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Unable to send calendar",
      },
      { status: 500 }
    );
  }
}
