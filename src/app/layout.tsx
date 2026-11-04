import type { ReactNode } from "react";
// ฟอนต์เสิร์ฟจากแอปเอง (แพ็กเกจ npm) ไม่ดึงจากเว็บภายนอก (NFR-PDPA-010)
import "@fontsource/sarabun/400.css";
import "@fontsource/sarabun/600.css";
import "@fontsource/bai-jamjuree/600.css";
import "./globals.css";

export const metadata = { title: "Bill Gen" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body className="font-sans">{children}</body>
    </html>
  );
}
