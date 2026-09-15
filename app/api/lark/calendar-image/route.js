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
    throw new Error("Unable to get Lark tenant access token");
  }

  return data.tenant_access_token;
}

export async function POST(request) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing image" },
        { status: 400 }
      );
    }

    const token = await getTenantToken();

    const imageBuffer = Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const form = new FormData();

    form.append(
      "image_type",
      "message"
    );

    form.append(
      "image",
      new Blob([imageBuffer], { type: "image/png" }),
      "sdc-calendar.png"
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
      return NextResponse.json(
        { error: "Image upload failed", uploadData },
        { status: 500 }
      );
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

    return NextResponse.json({
      ok: true,
      sendData,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Unable to send image",
      },
      { status: 500 }
    );
  }
}
