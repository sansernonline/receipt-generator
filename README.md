# BILLGEN — Thai Receipt Generator

แอปเว็บออกบิลภาษาไทยผ่านช่องแชต พิมพ์บอกรายการหรือส่งรูปบิลตัวอย่าง แล้ว AI ช่วยร่างบิลให้ แก้รายการและยอดรวมต่อได้ในแชต ยอดเงินทุกตัวคำนวณด้วยโค้ดของเรา ไม่ได้ใช้ตัวเลขที่ AI ตอบมา

## สถานะ

โปรเจกต์ยังพัฒนาอยู่ ตามตารางงาน 52 แถวใน `../docs/BUILD-PLAN.md` (ข้อมูล ณ 2569-11-05)

| ส่วน | สถานะ |
|---|---|
| ช่องแชต · รายการแชต · ค้นหา · เปลี่ยนชื่อ · ลบ · ชิปคำสั่งด่วน | เสร็จ |
| ตัวเชื่อม AI (Typhoon) · จำกัดการอ่านรูป · ปฏิเสธเรื่องนอกขอบเขต | เสร็จ (ยังไม่ได้ลองกับคีย์จริง) |
| ร่างบิลจากข้อความ · เพิ่ม แก้ ลบรายการ · ยอดรวม · VAT · เตือนยอดติดลบ | เสร็จ |
| อัปโหลดรูป · เก็บไฟล์แชตลงดิสก์ | เสร็จ |
| ตัวอย่างบิลข้างแชต · หัวร้านจากรูป · แม่แบบ 4 แบบ | ยังไม่ทำ |
| ยืนยันออกบิล · เวอร์ชันบิล · พิมพ์ · PDF | ยังไม่ทำ |

ตอนนี้เปิดแอปแล้วใช้ได้แค่ส่วนแชตและร่างบิล ยังไม่มีหน้าตัวอย่างบิลหรือไฟล์ PDF

## เทคโนโลยี

| ส่วน | ใช้อะไร |
|---|---|
| เฟรมเวิร์ก | Next.js 16 (App Router) · React 19 · TypeScript |
| หน้าตา | Tailwind CSS 4 · ฟอนต์ Bai Jamjuree และ Sarabun (`@fontsource`) |
| เก็บข้อมูล | ไฟล์ JSON บนดิสก์ ไม่มีฐานข้อมูล (ดู ADR-0002 ใน `../docs/decisions/`) |
| AI | Typhoon API ที่เข้ากันได้กับ OpenAI · โมเดลข้อความ `typhoon-v2.5-30b-a3b-instruct` · โมเดลอ่านรูป `typhoon-ocr` |
| ทดสอบ | Vitest (unit · integration) · Playwright (e2e บน Chrome และ Edge) |

## วิธีรัน

ต้องมี Node.js 22 ขึ้นไป (พัฒนาและทดสอบบน 22.23)

```bash
npm install
cp .env.example .env.local     # แล้วใส่ AI_API_KEY
npm run dev                    # เปิดที่ http://127.0.0.1:3000
```

ไม่ใส่ `AI_API_KEY` แอปก็เปิดได้ แต่ส่วนที่เรียก AI จะใช้ไม่ได้

ข้อมูลแชตเก็บที่โฟลเดอร์ `.billgen-data/` ใต้โฟลเดอร์โปรเจกต์ (ไม่ถูก commit) อยากย้ายที่เก็บให้ตั้ง `BILLGEN_DATA_DIR`

### ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าตั้งต้น | หมายเหตุ |
|---|---|---|
| `AI_API_KEY` | ว่าง | ความลับ ใส่ใน `.env.local` เท่านั้น ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_` |
| `AI_BASE_URL` | `https://api.opentyphoon.ai/v1` | เปลี่ยนผู้ให้บริการ AI ได้ด้วยตัวแปรกลุ่มนี้อย่างเดียว |
| `AI_MODEL_TEXT` | `typhoon-v2.5-30b-a3b-instruct` | |
| `AI_MODEL_OCR` | `typhoon-ocr` | |
| `BILLGEN_DATA_DIR` | `.billgen-data/` | **ต้องตั้งเมื่อรันแบบ production** ไม่ตั้งแอปจะไม่ยอมเริ่ม |
| `AI_MAX_TOKENS` | 8192 | ค่านี้ยังไม่ได้วัดกับ Typhoon จริง |
| `AI_TIMEOUT_MS` | 60000 | |
| `AI_MAX_CHUNKS` | 5 | จำนวนครั้งสูงสุดที่เรียก AI อ่านรูปต่อ 1 คำสั่ง |

อัตราภาษีมูลค่าเพิ่มตั้งต้น (7%) อยู่ใน `config/billgen.config.json`

## คำสั่งทั้งหมด

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิดโหมดพัฒนาที่ `127.0.0.1:3000` |
| `npm run build` | build แบบ standalone |
| `npm run smoke` | build ลงโฟลเดอร์แยก เปิดเซิร์ฟเวอร์ที่ `127.0.0.1:3200` แล้วเช็กว่าหน้าแรกตอบ 200 |
| `npm run test:unit` | unit test |
| `npm run test:integration` | integration test (รันทีละไฟล์ เพราะมี test จับเวลา) |
| `npm run test:e2e` | e2e ด้วย Playwright ที่พอร์ต 3100 ต้องมี Chrome และ Edge ติดตั้งในเครื่อง |
| `npm run verify <ฟีเจอร์>` | เปิดแอปบนพอร์ตว่าง รันเช็กของฟีเจอร์นั้น แล้วปิดแอปเสมอ |

test ไม่เรียก AI จริง ใช้ตัวจำลองใน `test/ai-stub/` ส่วน e2e ใช้โฟลเดอร์ข้อมูลของตัวเองที่ `test-results/e2e-data` ไม่แตะข้อมูลจริง

## โครงสร้าง

```
receipt-generator/
├─ src/
│  ├─ app/                 หน้าเว็บและ API route
│  │  └─ api/
│  │     ├─ chats/         GET · POST รายการแชต
│  │     │  └─ [id]/       GET · PATCH · DELETE แชตเดียว
│  │     │     └─ messages/  POST ส่งข้อความ (เรียก AI ที่นี่)
│  │     └─ consent/       POST บันทึกว่าผู้ใช้รับทราบการใช้ AI
│  └─ features/            โค้ดแยกตามฟีเจอร์ test อยู่ข้างไฟล์
│     ├─ ai/               ตัวเชื่อม Typhoon · prompt · ตรวจคำตอบ · กันข้อมูลรั่ว · จำกัดการอ่านรูป
│     ├─ baht-text/        ยอดเงินเป็นตัวอักษรไทย
│     ├─ chat/             หน้าจอแชต · รายการแชต · กล่องโต้ตอบ · ชิปคำสั่งด่วน
│     ├─ consent/          ประกาศการใช้ AI ที่แสดงครั้งเดียว
│     ├─ draft/            ร่างบิล · นำ operation จาก AI มาใช้กับร่าง · เช็กว่าออกบิลได้ไหม
│     ├─ pdf-filename/     ตั้งชื่อไฟล์ PDF
│     ├─ settings/         อ่านค่าตั้งต้น
│     ├─ storage/          เขียนไฟล์แบบอะตอมมิก · ล็อก · ดัชนีแชต · โฟลเดอร์ข้อมูล
│     ├─ thai-date/        วันที่แบบไทย
│     ├─ totals/           คำนวณยอดรวม · VAT · เงินเป็นสตางค์
│     └─ uploads/          ตรวจรูปที่อัปโหลด (ชนิดจากไบต์ต้นไฟล์ ไม่เกิน 10 MB)
├─ e2e/                    Playwright spec
├─ test/
│  ├─ ai-stub/             AI จำลองสำหรับ test
│  └─ e2e/                 สคริปต์ verify
├─ scripts/smoke.mjs       smoke test ของ build จริง
├─ config/                 ค่าตั้งต้นของแอป
└─ .env.example            รายชื่อตัวแปร (ไม่มีค่าจริง)
```

ชื่อไฟล์ test บอกชนิด: `*.unit.test.ts` · `*.integration.test.ts` · `*.e2e.spec.ts`

## หลักที่ใช้ในโค้ด

- **AI ร่างได้ แต่ไม่คิดเงิน** AI ส่งกลับเป็น operation (เพิ่ม แก้ ลบรายการ) เซิร์ฟเวอร์เอาไปใช้กับร่าง แล้วคำนวณยอดจาก `features/totals` เสมอ
- **ไม่ออกบิลเมื่อยอดติดลบหรือมีรายการที่ยังไม่มีราคา** (`features/draft/issue-blockers.ts`)
- **คีย์ AI อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น** ไม่มีตัวแปรที่ขึ้นต้น `NEXT_PUBLIC_`
- **ข้อความจากรูปเป็นข้อมูล ไม่ใช่คำสั่ง** และไม่เปิดเผยคำสั่งระบบ (`features/ai/leak.ts`)
- **ไม่มีระบบล็อกอิน** ป้องกันที่ระดับเครือข่ายแทน ให้รันที่ `127.0.0.1` แล้วเปิดออกผ่าน reverse proxy (ADR-0007)
- ค่าที่เป็นรหัสข้อกำหนด เช่น `FR-TOT-120` ในชื่อ commit และชื่อ test ชี้กลับไปที่ SRS

## รันแบบ production

```bash
npm run build
# build แบบ standalone ไม่รวมไฟล์ static ต้องคัดลอกเอง (ดูตัวอย่างใน scripts/smoke.mjs)
cp -r .next/static .next/standalone/.next/static
BILLGEN_DATA_DIR=/path/to/data HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js
```

- ต้องตั้ง `BILLGEN_DATA_DIR` ให้ชี้ไปนอกโฟลเดอร์ที่ deploy เพื่อให้ข้อมูลไม่หายเมื่ออัปเดตโค้ด
- แผนใน ADR-0007 คือรันบน Windows หลัง IIS reverse proxy ด้วยตัวจัดการ process ภายในเครื่อง ส่วนนี้ยังเป็นเอกสารเสนอ (ADR สถานะ "เสนอ") ยังไม่ได้ลองติดตั้งจริง

## เอกสารที่เกี่ยวข้อง

อยู่ที่โฟลเดอร์ `../docs/` (ถัดขึ้นไป 1 ชั้นจากโฟลเดอร์นี้)

| อยากรู้ | ดูที่ |
|---|---|
| สถานะงานและการตัดสินใจ | `docs/BUILD-PLAN.md` |
| ข้อกำหนด (SRS) | `docs/BILLGEN-SRS-v0.1-DRAFT.docx` |
| สถาปัตยกรรมและเหตุผลที่เลือก | `docs/BILLGEN-ARCH-v0.1-DRAFT.docx` · `docs/decisions/` |
| User stories | `docs/USER-STORIES.md` |
| prompt ที่ใช้กับ AI | `docs/PROMPT-LIBRARY.md` |
| นโยบายประเมินผล AI | `docs/EVALUATION-POLICY.md` |
| test case | `qa/BILLGEN-test-cases.md` |
| หน้าจอต้นแบบที่กดได้ | `mockup/BILLGEN-mockup.html` |
| วิธีให้ agent เขียนโค้ดต่อทีละข้อกำหนด | `docs/AGENT-LOOP.md` |
