import fsp from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { GET as getDraft } from "@/app/api/chats/[id]/draft/route";
import { POST as confirm } from "@/app/api/chats/[id]/shop/route";
import { useChatWithDraft } from "@/features/draft/chat-harness";
import { emptyDraft } from "@/features/draft/parse-draft";
import { cashShop } from "./test-kit";

const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };

describe("the shop's colour and logo on POST /api/chats/[id]/shop (FR-HDR-040 · 050 · 170)", () => {
  const { dataDir, chatId, readChatFile } = useChatWithDraft(emptyDraft, { hasShop: false });
  const post = (body: unknown) =>
    confirm(new Request("http://localhost/api/shop", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id: chatId() }) });
  const shopDir = (shopId: string) => path.join(dataDir(), "shops", shopId);
  const shopFile = async (shopId: string) => JSON.parse(await fsp.readFile(path.join(shopDir(shopId), "shop.json"), "utf8"));
  const openedShop = async () => (await (await getDraft(new Request("http://localhost/x"), { params: Promise.resolve({ id: chatId() }) })).json()).shop;

  test("[FR-HDR-040] the accent colour is saved in shop.json and comes back with the shop", async () => {
    const { shop } = await (await post({ ...cashShop, accent: "#1F4E9C" })).json();

    expect((await shopFile(shop.id)).accent).toBe("#1f4e9c");
    expect((await openedShop()).accent).toBe("#1f4e9c");
  });

  test("[FR-HDR-040] an accent that is not #rrggbb is dropped: it would end up in a style on the bill", async () => {
    const { shop } = await (await post({ ...cashShop, accent: "red; background:url(//evil.example)" })).json();

    expect((await shopFile(shop.id)).accent).toBeUndefined();
  });

});
