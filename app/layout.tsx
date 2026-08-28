import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = (() => {
  const metadataBase = new URL("https://zozo971209-pixel.github.io/vocabflow-6004/");
  const title = "詞序 VocabFlow｜高中英文每日學習";
  const description = "每天依級別學習 6,004 個台灣高中英文參考詞彙，支援朗讀、搜尋、熟悉度標記與本機進度保存。";
  return {
    metadataBase,
    title,
    description,
    manifest: "/vocabflow-6004/manifest.webmanifest",
    icons: { icon: "/vocabflow-6004/favicon.svg", shortcut: "/vocabflow-6004/favicon.svg", apple: "/vocabflow-6004/icon-192.png" },
    openGraph: { title, description, images: [{ url: "/vocabflow-6004/og.png", width: 1536, height: 1024, alt: "詞序 VocabFlow 高中英文每日學習" }] },
    twitter: { card: "summary_large_image", title, description, images: ["/vocabflow-6004/og.png"] },
  };
})();

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f46e5" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const appearanceScript = `try{const s=JSON.parse(localStorage.getItem('vocab6004-settings-v1')||'{}');document.documentElement.dataset.theme=s.theme==='dark'?'dark':'light';document.documentElement.dataset.fontSize=['small','normal','large'].includes(s.fontSize)?s.fontSize:'normal'}catch{}`;
  return <html lang="zh-Hant" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: appearanceScript }} /></head><body>{children}</body></html>;
}
