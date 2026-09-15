import { NextResponse } from "next/server";

async function getToken() {
  const response = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET,
      }),
    }
  );

  const data = await response.json();

  if (!data.tenant_access_token) {
    throw new Error("Unable to authenticate with Lark");
  }

  return data.tenant_access_token;
}

function createCalendarSvg(events = []) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.toLocaleString("en-US", { month: "long" });
  const today = now.getDate();

  const days = new Date(year, now.getMonth() + 1, 0).getDate();
  const first = new Date(year, now.getMonth(), 1).getDay();

  let cells = "";

  for (let i = 0; i < 42; i++) {
    const day = i - first + 1;
    const x = 40 + (i % 7) * 65;
    const y = 140 + Math.floor(i / 7) * 55;

    if (day > 0 && day <= days) {
      const active = day === today;

      cells += `
        <text x="${x}" y="${y}" 
          font-size="18"
          fill="${active ? "#ffffff" : "#222"}">
          ${day}
        </text>
        ${
          active
            ? `<circle cx="${x - 5}" cy="${y - 7}" r="20" fill="#ff6b45"/>`
            : ""
        }
      `;
    }
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="700" height="520">
    <rect width="100%" height="100%" rx="20" fill="#ffffff"/>
    <text x="40" y="55" font-size="28" font-weight="700">
      📅 SDC Creative Calendar
    </text>
    <text x="40" y="100" font-size="22" font-weight="600">
      ${month} ${year}
    </text>

    <text x="40" y="125" font-size="15">
      Sun   Mon   Tue   Wed   Thu   Fri   Sat
    </text>

    ${cells}

    <text x="40" y="430" font-size="20" font-weight="700">
      📌 Today's Schedule
    </text>

    <text x="40" y="470" font-size="16">
      ${events[0]?.title || "No scheduled events"}
    </text>
  </svg>`;
}

export async function POST(request) {
  try {
    const { events = [] } = await request.json();

    const token = await getToken();

    const svg = createCalendarSvg(events);

    const imageResponse = await fetch(
      "https://open.larksuite.com/open-apis/im/v1/images",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: (() => {
          const form = new FormData();
          form.append("image_type", "message");
          form.append(
            "image",
            new Blob([svg], { type: "image/svg+xml" }),
            "calendar.svg"
          );
          return form;
        })(),
      }
    );

    const imageData = await imageResponse.json();

    if (!imageData.data?.image_key) {
      throw new Error("Lark image upload failed");
    }

    const send = await fetch(
      "https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=chat_id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receive_id: process.env.LARK_CHAT_ID,
          msg_type: "image",
          content: JSON.stringify({
            image_key: imageData.data.image_key,
          }),
        }),
      }
    );

    return NextResponse.json(await send.json());
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
