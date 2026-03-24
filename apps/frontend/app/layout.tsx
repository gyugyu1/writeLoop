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
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "https://writeloop.kr",
    siteName: siteTitle,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "writeLoop 로고와 서비스 소개 이미지"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image"]
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
