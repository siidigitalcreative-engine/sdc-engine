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
  console.log("LARK TOKEN RESPONSE", data);

  if (!data.tenant_access_token) {
    throw new Error(JSON.stringify(data));
  }

  return data.tenant_access_token;
}

function createSvg(events = []) {
  const date = new Date();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  const today = date.getDate();

  const totalDays = new Date(
    year,
    date.getMonth() + 1,
    0
  ).getDate();

  const firstDay = new Date(
    year,
    date.getMonth(),
    1
  ).getDay();

  let days = "";

  for (let i = 0; i < totalDays; i++) {
    const index = firstDay + i;
    const x = 70 + (index % 7) * 70;
    const y = 190 + Math.floor(index / 7) * 55;

    if (i + 1 === today) {
      days += `<circle cx="${x}" cy="${y - 7}" r="20" fill="#ff6b45"/>`;
      days += `<text x="${x}" y="${y}" text-anchor="middle" fill="white" font-size="18">${i + 1}</text>`;
    } else {
      days += `<text x="${x}" y="${y}" text-anchor="middle" fill="#222" font-size="18">${i + 1}</text>`;
    }
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500">
<rect width="700" height="500" rx="20" fill="white"/>
<text x="40" y="50" font-size="28" font-weight="700">📅 SDC Creative Calendar</text>
<text x="40" y="95" font-size="22">${month} ${year}</text>
<text x="50" y="140" font-size="16">Sun   Mon   Tue   Wed   Thu   Fri   Sat</text>
${days}
<text x="40" y="430" font-size="22" font-weight="700">📌 Today's Schedule</text>
<text x="40" y="465" font-size="16">${events[0]?.title || "No scheduled events"}</text>
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

    const uploadResponse = await fetch(
      "https://open.larksuite.com/open-apis/im/v1/images",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    const uploadData = await uploadResponse.json();
    console.log("LARK UPLOAD RESPONSE", uploadData);

    if (!uploadData.data?.image_key) {
      throw new Error(JSON.stringify(uploadData));
    }

    const sendResponse = await fetch(
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

    const sendData = await sendResponse.json();
    console.log("LARK SEND RESPONSE", sendData);

    if (!sendResponse.ok) {
      throw new Error(JSON.stringify(sendData));
    }

    return NextResponse.json({
      success: true,
      sendData,
    });
  } catch (error) {
    console.error("LARK CALENDAR ERROR", error);

    return NextResponse.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
