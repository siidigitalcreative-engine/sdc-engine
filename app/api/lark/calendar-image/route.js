import { NextResponse } from "next/server";
import zlib from "zlib";

function createPng(width, height) {
  const raw = [];

  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      let r = 255;
      let g = 255;
      let b = 255;

      if (x < 6 || y < 6 || x > width - 7 || y > height - 7) {
        r = 245;
        g = 245;
        b = 245;
      }

      raw.push(r, g, b, 255);
    }
  }

  function chunk(type, data) {
    const buffer = Buffer.alloc(12 + data.length);
    buffer.writeUInt32BE(data.length, 0);
    buffer.write(type, 4);
    data.copy(buffer, 8);

    const crc = require("crc-32").buf(Buffer.concat([
      Buffer.from(type),
      data
    ])) >>> 0;

    buffer.writeUInt32BE(crc, 8 + data.length);
    return buffer;
  }

  const signature = Buffer.from([
    137,80,78,71,13,10,26,10
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);
  ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;
  ihdr[9]=6;

  const idat = zlib.deflateSync(Buffer.from(raw));

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", iend)
  ]);
}

async function getToken() {
  const response = await fetch(
    "https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app_id: process.env.LARK_APP_ID,
        app_secret: process.env.LARK_APP_SECRET
      })
    }
  );

  const data = await response.json();

  if (!data.tenant_access_token) {
    throw new Error(JSON.stringify(data));
  }

  return data.tenant_access_token;
}

export async function POST(request) {
  try {
    const token = await getToken();

    const png = createPng(700, 500);

    const form = new FormData();
    form.append("image_type", "message");
    form.append(
      "image",
      new Blob([png], { type: "image/png" }),
      "calendar.png"
    );

    const upload = await fetch(
      "https://open.larksuite.com/open-apis/im/v1/images",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
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
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          receive_id: process.env.LARK_CHAT_ID,
          msg_type: "image",
          content: JSON.stringify({
            image_key: uploadData.data.image_key
          })
        })
      }
    );

    const sendData = await send.json();

    if (!send.ok) {
      throw new Error(JSON.stringify(sendData));
    }

    return NextResponse.json({
      success: true,
      sendData
    });

  } catch (error) {
    console.error("LARK CALENDAR ERROR", error);

    return NextResponse.json(
      {
        error: error.message
      },
      {
        status: 500
      }
    );
  }
}
