import type { ShopFields, ShopProposal } from "@/features/shop-header/types";
import type { VatMode } from "@/features/totals/types";
import { type Ctx, type Failure, MAX_OCR_CHARS, failed, takeImageRights, withContext } from "./ask-ai";
import { TEMPLATE_OF, readShopReply } from "./ask-shop";
import { logged } from "./call-log";
import { inputBudgetChars } from "./chunk-text";
import { ocrPage } from "./connector";
import { MESSAGE_INVALID_REPLY, MESSAGE_NO_SHOP_IN_IMAGE, MESSAGE_UNSUPPORTED_DOC } from "./messages";
import { P005_GUARD } from "./prompt-texts";
import { buildShopImageMessage } from "./prompts";
import { refusalMessage } from "./refusals";
import { P001_SYSTEM } from "./shop-prompt-texts";
import type { AskAiDeps, ImageInput } from "./types";
import { type ShopImageHeader, type ShopImageReply, parseShopImageReply } from "./validate-shop-image-reply";

const PROMPT = { id: "P-001", version: "0.3", parse: parseShopImageReply };

export type AskShopImageInput = { chatId: string; image: ImageInput };

/** card = what the user may review. The chat is never touched here (FR-HDR-070). */
export type AskShopImageResult = { ok: true; card: ShopProposal } | Failure;

const VAT_OF: Record<NonNullable<ShopImageHeader["vat_mode"]>, VatMode> = { none: "none", included: "inclusive", excluded: "exclusive" };
const FIELD_OF: Record<string, keyof ShopFields> = { shop_name: "shopName", address: "address", tax_id: "taxId", phone: "phone", email: "email", doc_type: "template" };

function toCard({ header, uncertain }: ShopImageReply & { header: ShopImageHeader }): ShopProposal {
  const unsure = uncertain.flatMap((name) => FIELD_OF[name] ?? []);
  return {
    shopName: header.shop_name ?? "", address: header.address ?? "", taxId: header.tax_id ?? "", phone: header.phone ?? "", email: header.email ?? "",
    template: TEMPLATE_OF[header.doc_type],
    vatMode: VAT_OF[header.vat_mode ?? "none"], // not clear in the picture = none, never a guess (FR-TOT-040)
    ...(unsure.length ? { uncertain: unsure } : {}),
  };
}

export const askShopImage = (input: AskShopImageInput, deps: AskAiDeps): Promise<AskShopImageResult> => withContext(input.chatId, deps, (ctx) => run(input, ctx));

async function run({ chatId, image }: AskShopImageInput, ctx: Ctx): Promise<AskShopImageResult> {
  const refused = takeImageRights(1, ctx);
  if (refused) return refused;
  const ocrText = await logged(ctx, { chatId, promptId: "OCR", model: ctx.config.modelOcr }, () => ocrPage(ctx.config, image, ctx.fetch));
  const system = P001_SYSTEM.replace("{{GUARD}}", P005_GUARD.replace("{{canary}}", ctx.canary));
  const user = buildShopImageMessage(ocrText.slice(0, Math.min(MAX_OCR_CHARS, inputBudgetChars(ctx.config, system.length))));

  const reply = await readShopReply(chatId, ctx, PROMPT, system, user);
  if (!reply) return failed("invalid_reply", MESSAGE_INVALID_REPLY);
  if (reply.status === "refuse") return failed("refused", refusalMessage(reply.reason, null));
  if (reply.status === "empty") return failed("no_shop_in_image", MESSAGE_NO_SHOP_IN_IMAGE);
  if (reply.status === "unsupported_doc") return failed("unsupported_doc", MESSAGE_UNSUPPORTED_DOC); // no template is picked quietly (TC-HDR-055)
  return { ok: true, card: toCard(reply as ShopImageReply & { header: ShopImageHeader }) };
}
