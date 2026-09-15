import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const webhook = process.env.LARK_CALENDAR_BOT_WEBHOOK;

    if (!webhook) {
      return NextResponse.json(
        { error: "Missing LARK_CALENDAR_BOT_WEBHOOK" },
        { status: 500 }
      );
    }

    const { content = "SDC Calendar update." } = await request.json();

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
                content,
              },
            },
          ],
        },
      }),
    });

    const result = await response.json().catch(() => ({}));

    return NextResponse.json({ ok: response.ok, result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to send to Lark" },
      { status: 500 }
    );
  }
}
