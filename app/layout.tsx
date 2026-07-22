import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = (() => {
  const metadataBase = new URL("https://zozo971209-pixel.github.io/vocabflow-6004/");
  const title = "詞序 VocabFlow｜高中英文每日學習";
  const description = "每天依級別學習 6,004 個台灣高中英文參考詞彙，支援朗讀、搜尋、熟悉度標記與本機進度保存。";
  return {
    metadataBase,
    title,
    description,
    icons: { icon: "/vocabflow-6004/favicon.svg", shortcut: "/vocabflow-6004/favicon.svg" },
    openGraph: { title, description, images: [{ url: "/vocabflow-6004/og.png", width: 1536, height: 1024, alt: "詞序 VocabFlow 高中英文每日學習" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/vocabflow-6004/og.png"] },
  };
})();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
