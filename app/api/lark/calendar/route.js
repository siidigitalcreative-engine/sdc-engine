import { NextResponse } from "next/server";

function getCalendarGrid(date, events = []) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthName = date.toLocaleString("en-US", { month: "long" });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = date.getDate();

  const eventMarkers = {};

  events.forEach((event) => {
    const eventDate = new Date(event.start);
    if (
      eventDate.getMonth() === month &&
      eventDate.getFullYear() === year
    ) {
      eventMarkers[eventDate.getDate()] = "•";
    }
  });

  let rows = [];
  let current = 1;

  for (let week = 0; week < 6; week++) {
    let row = [];

    for (let day = 0; day < 7; day++) {
      const position = week * 7 + day;

      if (position < firstDay || current > totalDays) {
        row.push(" ");
      } else {
        const marker = eventMarkers[current] || "";
        const value = current === today
          ? `🔵${current}`
          : `${current}${marker}`;

        row.push(value);
        current++;
      }
    }

    rows.push(row.join("   "));
  }

  return {
    title: `${monthName} ${year}`,
    grid: rows.join("\n"),
  };
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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
    const calendar = getCalendarGrid(now, events);

    const schedule = events.length
      ? events
          .map((event) => {
            return `**${formatTime(event.start)}**  ${event.title}`;
          })
          .join("\n\n")
      : "No events scheduled today.";

    const payload = {
      msg_type: "interactive",
      card: {
        config: {
          wide_screen_mode: true,
        },
        header: {
          template: "blue",
          title: {
            tag: "plain_text",
            content: "📅 SDC Calendar",
          },
        },
        elements: [
          {
            tag: "div",
            fields: [
              {
                is_short: false,
                text: {
                  tag: "lark_md",
                  content:
                    `**${calendar.title}**\n\n` +
                    "```\n" +
                    "Su  Mo  Tu  We  Th  Fr  Sa\n" +
                    calendar.grid +
                    "\n```",
                },
              },
              {
                is_short: false,
                text: {
                  tag: "lark_md",
                  content:
                    `**📌 Today's Schedule**\n\n${schedule}`,
                },
              },
            ],
          },
          {
            tag: "hr",
          },
          {
            tag: "action",
            actions: [
              {
                tag: "button",
                text: {
                  tag: "plain_text",
                  content: "View Full Calendar",
                },
                type: "primary",
                url: "https://sdc-engine.vercel.app/calendar",
              },
            ],
          },
        ],
      },
    };

    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
