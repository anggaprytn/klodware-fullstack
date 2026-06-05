const appBaseUrl = process.env.APP_BASE_URL;
const adminUsername = process.env.KLODWARE_ADMIN_USERNAME;
const adminPassword = process.env.KLODWARE_ADMIN_PASSWORD;
const mobileUsername = process.env.KLODWARE_MOBILE_USERNAME;
const mobilePassword = process.env.KLODWARE_MOBILE_PASSWORD;

if (!appBaseUrl || !adminUsername || !adminPassword || !mobileUsername || !mobilePassword) {
  console.error(
    [
      "Missing required env vars:",
      "APP_BASE_URL",
      "KLODWARE_ADMIN_USERNAME",
      "KLODWARE_ADMIN_PASSWORD",
      "KLODWARE_MOBILE_USERNAME",
      "KLODWARE_MOBILE_PASSWORD",
    ].join("\n"),
  );
  process.exit(1);
}

const appBase = appBaseUrl;

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  ),
);

function actionId(html: string, heading: string) {
  const pattern = new RegExp(`<h2>${heading}<\\/h2>[\\s\\S]*?name="(\\$ACTION_ID_[^"]+)"`);
  const id = pattern.exec(html)?.[1];
  if (!id) throw new Error(`Unable to find ${heading} action id.`);
  return id;
}

async function adminCookie() {
  const response = await fetch(new URL("/api/admin/auth/login", appBase), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: adminUsername,
      password: adminPassword,
    }),
  });
  const cookie = /klodware_admin_token=[^;]+/.exec(
    response.headers.get("set-cookie") ?? "",
  )?.[0];

  if (!response.ok || !cookie) {
    throw new Error(`Admin login failed with status ${response.status}.`);
  }

  return cookie;
}

async function mobileToken() {
  const response = await fetch(new URL("/api/mobile/auth/login", appBase), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: mobileUsername,
      password: mobilePassword,
    }),
  });
  const body = await response.json();
  const token = body.data?.access_token;

  if (!response.ok || !token) {
    throw new Error(`Mobile login failed with status ${response.status}.`);
  }

  return token as string;
}

async function main() {
  const cookie = await adminCookie();
  const vesselsPage = await fetch(new URL("/admin/vessels", appBase), {
    headers: { cookie },
  });
  const html = await vesselsPage.text();
  const createAction = actionId(html, "Create Vessel");
  const unique = `SMOKE-${Date.now()}`;
  const name = `Vessel Image Smoke ${unique}`;

  const form = new FormData();
  form.append(createAction, "");
  form.append("name", name);
  form.append("imo", unique.replace(/\D/g, "").slice(-7).padStart(7, "1"));
  form.append("mmsi", "525999999");
  form.append("call_sign", "SMK");
  form.append("flag", "Indonesia");
  form.append("year_built", "2026");
  form.append("status", "active");
  form.append("image", new File([png], `${unique}.png`, { type: "image/png" }));

  const createResponse = await fetch(new URL("/admin/vessels", appBase), {
    method: "POST",
    headers: {
      cookie,
      origin: appBase,
      referer: new URL("/admin/vessels", appBase).toString(),
    },
    body: form,
  });

  if (!createResponse.ok) {
    throw new Error(`Create vessel failed with status ${createResponse.status}.`);
  }

  const token = await mobileToken();
  const vesselsResponse = await fetch(new URL("/api/mobile/vessels", appBase), {
    headers: { authorization: `Bearer ${token}` },
  });
  const vesselsBody = await vesselsResponse.json();
  const vessel = vesselsBody.data?.vessels?.find((item: { name?: string }) => item.name === name);

  if (!vessel?.image_url) {
    throw new Error("Created vessel did not return image_url from mobile API.");
  }

  const imageResponse = await fetch(vessel.image_url);
  const contentType = imageResponse.headers.get("content-type") ?? "";
  if (!imageResponse.ok || !contentType.startsWith("image/")) {
    throw new Error(
      `Vessel image URL failed: status ${imageResponse.status}, content-type ${contentType}.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        created_vessel_id: vessel.id,
        mobile_api_image_url: true,
        image_url_status: imageResponse.status,
        image_url_content_type: contentType,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
