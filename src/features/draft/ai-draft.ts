import type { Draft } from "./types";

const VAT_MODE_FOR_AI = { none: "none", inclusive: "included", exclusive: "excluded" } as const;

/** The compact draft the AI reads (PROMPT-LIBRARY P-004 {{draft}}): no shop header, no amounts, only a flag that payment detail exists. */
export function toAiDraft({ items, bill, footer }: Draft) {
  return {
    items: items.map((item, i) => ({
      line: i + 1, name: item.name, description: item.description, qty: item.qty, unit: item.unit, unit_price: item.unitPrice, line_discount: item.discount,
    })),
    bill_info: {
      customer_name: bill.customerName, customer_address: bill.customerAddress, customer_tax_id: bill.customerTaxId,
      customer_phone: bill.customerPhone, customer_email: bill.customerEmail, doc_no: bill.billNumber, doc_date: bill.billDate,
      ref: bill.ref, due_date: bill.dueDate, quote_ref: bill.quoteRef, quoted_by: bill.quotedBy,
    },
    footer: {
      vat_mode: VAT_MODE_FOR_AI[footer.vat.mode], discount: footer.discount, payment_method: footer.paymentMethod,
      payment_detail_set: footer.paymentDetail !== null, remarks: footer.remarks,
    },
  };
}
