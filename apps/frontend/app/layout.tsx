import type { Metadata } from "next";
import { TopNavigation } from "../components/top-navigation";
import "./globals.css";

const siteTitle = "writeLoop";
const siteDescription =
  "한국인을 위한 영어 작문 훈련 서비스예요. 오늘의 질문으로 짧게 쓰고, 한국어 피드백과 다시쓰기로 매일 꾸준히 영어 글쓰기 습관을 만들어요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://writeloop.kr"),
  title: {
    default: siteTitle,
    template: `%s | ${siteTitle}`
  },
  description: siteDescription,
  icons: {
    icon: "/brand-symbol.png",
    shortcut: "/brand-symbol.png",
    apple: "/brand-symbol.png"
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://writeloop.kr",
    siteName: siteTitle,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/brand-symbol.png",
        width: 1024,
        height: 1024,
        alt: "writeLoop 로고"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/brand-symbol.png"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <TopNavigation />
        {children}
      </body>
    </html>
  );
}
