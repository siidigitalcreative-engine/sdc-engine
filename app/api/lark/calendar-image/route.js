import { NextResponse } from "next/server";
import zlib from "zlib";

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const output = Buffer.alloc(data.length + 12);

  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);

  const crc = crc32(Buffer.concat([typeBuffer, data]));
  output.writeUInt32BE(crc, data.length + 8);

  return output;
}

function createPng(width, height) {
  const rows = [];

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;

    for (let x = 0; x < width; x++) {
      const index = 1 + x * 4;

      row[index] = 255;
      row[index + 1] = 255;
      row[index + 2] = 255;
      row[index + 3] = 255;
    }

    rows.push(row);
  }

  const signature = Buffer.from([
    137,80,78,71,13,10,26,10
  ]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const compressed = zlib.deflateSync(Buffer.concat(rows));

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

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
    throw new Error(JSON.stringify(data));
  }

  return data.tenant_access_token;
}

export async function POST() {
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
      success: true,
      sendData,
    });
  } catch (error) {
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
