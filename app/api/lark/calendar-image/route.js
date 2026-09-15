import { NextResponse } from "next/server";

async function getTenantToken() {
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
    throw new Error(JSON.stringify(data));
  }

  return data.tenant_access_token;
}

function createSvg(events = []) {
  const now = new Date();
  const year = now.getFullYear();
  const monthName = now.toLocaleString("en-US", { month: "long" });
  const days = new Date(year, now.getMonth() + 1, 0).getDate();
  const firstDay = new Date(year, now.getMonth(), 1).getDay();

  let calendar = "";
  let day = 1;

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      if ((row === 0 && col < firstDay) || day > days) continue;

      const x = 60 + col * 70;
      const y = 190 + row * 55;

      if (day === now.getDate()) {
        calendar += `<circle cx="${x}" cy="${y - 8}" r="22" fill="#ff6b45"/>`;
        calendar += `<text x="${x}" y="${y}" text-anchor="middle" font-size="18" fill="white">${day}</text>`;
      } else {
        calendar += `<text x="${x}" y="${y}" text-anchor="middle" font-size="18" fill="#222">${day}</text>`;
      }

      day++;
    }
  }

  const schedule =
    events.length > 0
      ? events.map((e) => e.title).join(", ")
      : "No scheduled events";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="600">
<rect width="700" height="600" rx="24" fill="white"/>
<text x="40" y="55" font-size="28" font-weight="700">📅 SDC Creative Calendar</text>
<text x="40" y="105" font-size="22" font-weight="600">${monthName} ${year}</text>

<text x="60" y="145" font-size="16">Sun   Mon   Tue   Wed   Thu   Fri   Sat</text>

${calendar}

<text x="40" y="500" font-size="22" font-weight="700">📌 Today's Schedule</text>
<text x="40" y="545" font-size="16">${schedule}</text>
</svg>`;
}

export async function POST(request) {
  try {
    const { events = [] } = await request.json();

    const token = await getTenantToken();

    const svg = createSvg(events);

    const form = new FormData();
    form.append("image_type", "message");
    form.append(
      "image",
      new Blob([svg], { type: "image/svg+xml" }),
      "calendar.svg"
    );

    const upload = await fetch(
      "https://open.larksuite.com/open-apis/im/v1/images",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    const uploadData = await upload.json();

    if (!uploadData.data?.image_key) {
      throw new Error(JSON.stringify(uploadData));
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
            image_key: uploadData.data.image_key,
          }),
        }),
      }
    );

    const sendData = await send.json();

    if (!send.ok) {
      throw new Error(JSON.stringify(sendData));
    }

    return NextResponse.json({
      ok: true,
      sendData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Lark calendar image failed",
      },
      { status: 500 }
    );
  }
}
