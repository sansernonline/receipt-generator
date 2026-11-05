import { describe, expect, test } from "vitest";
import { POST as confirm } from "@/app/api/chats/[id]/shop/route";
import { createImageLimiter } from "@/features/ai/image-limiter";
import { useChatWithDraft } from "@/features/draft/chat-harness";
import { emptyDraft } from "@/features/draft/parse-draft";
import { createStore } from "@/features/storage/store";
import { reply } from "../../../test/ai-stub/ai-stub";
import { sendShopImage } from "./send-shop-image";
import { cashShop, shopReplyBody, shopImageReplyBody } from "./test-kit";
import { bluePng } from "./test-png";

const headers = { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" };

describe("the tax mode the draft starts with, set by the shop header (FR-TOT-040)", () => {
  const { stub, send, readDraftFile, dataDir, chatId } = useChatWithDraft(emptyDraft, { hasShop: false });
  const post = (body: unknown) =>
    confirm(new Request("http://localhost/api/shop", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id: chatId() }) });
  const sendPicture = (vatMode: string | null) => {
    stub().script("ocr", reply("ใบเสร็จรับเงิน"));
    stub().script("text", reply(shopImageReplyBody({}, { doc_type: "receipt", vat_mode: vatMode })));
    return sendShopImage(createStore(dataDir()), chatId(), { bytes: bluePng() }, { imageLimiter: createImageLimiter() });
  };

  test("[TC-TOT-017] shop info typed with no picture: the card is used as it is and the tax mode is none", async () => {
    stub().script("text", reply(shopReplyBody()));
    const { shopCard } = await send("ร้านกาแฟบ้านสวน โทร 038-123456 ออกบิลเงินสด");

    await post(shopCard);

    expect((await readDraftFile()).footer.vat.mode).toBe("none");
  });

  test("[TC-TOT-017] typed text that says the tax is on top still gives none: only a sample bill sets the mode", async () => {
    stub().script("text", reply(shopReplyBody({}, { vat_mode: "excluded" })));
    const { shopCard } = await send("ร้านกาแฟบ้านสวน ราคาแยกภาษี");

    await post(shopCard);

    expect((await readDraftFile()).footer.vat.mode).toBe("none");
  });

  test("[TC-TOT-018] a picture whose tax mode the AI left empty: the card says none and the draft starts with none", async () => {
    const { shopCard } = await sendPicture(null);

    await post(shopCard);

    expect(shopCard?.vatMode).toBe("none");
    expect((await readDraftFile()).footer.vat.mode).toBe("none");
  });

  test.each([["excluded", "exclusive"], ["included", "inclusive"]])("[FR-TOT-040] vat_mode %s on the picture: the draft starts with %s once the card is used", async (vatMode, expected) => {
    const { shopCard } = await sendPicture(vatMode);

    const res = await post(shopCard);

    expect((await readDraftFile()).footer.vat.mode).toBe(expected);
    expect((await res.json()).draft.footer.vat.mode).toBe(expected);
  });

  test("[FR-TOT-040] the user can change the mode on the card before using it", async () => {
    const { shopCard } = await sendPicture("excluded");

    await post({ ...shopCard, vatMode: "inclusive" });

    expect((await readDraftFile()).footer.vat.mode).toBe("inclusive");
  });

  test("[FR-TOT-040] the mode is not kept in shop.json, only in the draft", async () => {
    const res = await post({ ...cashShop, vatMode: "exclusive" });

    expect((await res.json()).shop.vatMode).toBeUndefined();
  });

  test("[FR-TOT-040] a tax mode that is not one of the three is refused", async () => {
    const res = await post({ ...cashShop, vatMode: "reverse-charge" });

    expect(res.status).toBe(400);
    expect((await readDraftFile()).footer.vat.mode).toBe("none");
  });
});
