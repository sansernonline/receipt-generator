import fsp from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { GET as getDraft } from "@/app/api/chats/[id]/draft/route";
import { POST as confirm } from "@/app/api/chats/[id]/shop/route";
import { useChatWithDraft } from "@/features/draft/chat-harness";
import { emptyDraft } from "@/features/draft/parse-draft";
import { cashShop } from "./test-kit";
import { bluePng } from "./test-png";

const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };
const toDataUrl = (bytes: Uint8Array) => `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
const LOGO = toDataUrl(bluePng()); // a made-up logo of ours

describe("the shop's colour and logo on POST /api/chats/[id]/shop (FR-HDR-040 · 050 · 170)", () => {
  const { dataDir, chatId, readChatFile } = useChatWithDraft(emptyDraft, { hasShop: false });
  const post = (body: unknown) =>
    confirm(new Request("http://localhost/api/shop", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id: chatId() }) });
  const shopDir = (shopId: string) => path.join(dataDir(), "shops", shopId);
  const shopFile = async (shopId: string) => JSON.parse(await fsp.readFile(path.join(shopDir(shopId), "shop.json"), "utf8"));
  const openedShop = async () => (await (await getDraft(new Request("http://localhost/x"), { params: Promise.resolve({ id: chatId() }) })).json()).shop;

  test("[TC-HDR-050] the user chose no logo: the shop is saved and there is no logo.png in its folder", async () => {
    const res = await post(cashShop);

    expect(res.status).toBe(201);
    const { shop } = await res.json();
    expect(await fsp.readdir(shopDir(shop.id))).toEqual(["shop.json"]);
    expect(shop.logo).toBeUndefined();
  });

  test("[FR-HDR-170] the user chose the logo: logo.png is saved with the shop, the crop goes in shop.json, not the picture", async () => {
    const { shop } = await (await post({ ...cashShop, logo: LOGO, logoCrop: [10, 20, 300, 120] })).json();

    expect((await fsp.readFile(path.join(shopDir(shop.id), "logo.png"))).equals(bluePng())).toBe(true);
    const stored = await shopFile(shop.id);
    expect(stored.logoCrop).toEqual([10, 20, 300, 120]);
    expect(JSON.stringify(stored)).not.toContain("base64");
  });

  test("[FR-HDR-170] the bill's data carries the logo as a data URL, also when the chat is opened again", async () => {
    await post({ ...cashShop, logo: LOGO, logoCrop: [0, 0, 8, 8] });

    expect((await openedShop()).logo).toBe(LOGO);
  });

  test("[FR-HDR-170] a crop sent with no logo is not kept", async () => {
    const { shop } = await (await post({ ...cashShop, logoCrop: [0, 0, 8, 8] })).json();

    expect((await shopFile(shop.id)).logoCrop).toBeUndefined();
  });

  test.each([
    ["not a data URL", "https://evil.example/logo.png"],
    ["a JPEG in a PNG data URL", `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64")}`],
    ["a text in a PNG data URL", `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`],
    ["bad base64 characters", "data:image/png;base64,@@@@"],
    ["more than 512 KB", toDataUrl(Buffer.concat([bluePng(), Buffer.alloc(512 * 1024)]))],
  ])("[FR-HDR-170] a logo that is %s is refused and nothing is saved", async (_name, logo) => {
    const res = await post({ ...cashShop, logo });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("โลโก้ไม่ถูกต้อง");
    expect((await readChatFile()).shopId).toBeNull();
    await expect(fsp.readdir(path.join(dataDir(), "shops"))).rejects.toThrow();
  });

  test("[FR-HDR-040] the accent colour is saved in shop.json and comes back with the shop", async () => {
    const { shop } = await (await post({ ...cashShop, accent: "#1F4E9C" })).json();

    expect((await shopFile(shop.id)).accent).toBe("#1f4e9c");
    expect((await openedShop()).accent).toBe("#1f4e9c");
  });

  test("[FR-HDR-040] an accent that is not #rrggbb is dropped: it would end up in a style on the bill", async () => {
    const { shop } = await (await post({ ...cashShop, accent: "red; background:url(//evil.example)" })).json();

    expect((await shopFile(shop.id)).accent).toBeUndefined();
  });

  test("[FR-HDR-040] a crop of the wrong shape is dropped", async () => {
    const { shop } = await (await post({ ...cashShop, logo: LOGO, logoCrop: [1, 2, "3", -4] })).json();

    expect((await shopFile(shop.id)).logoCrop).toBeUndefined();
  });
});
