import type { Metadata } from "next";
import localFont from "next/font/local";
import { TopNavigation } from "../components/top-navigation";
import "./globals.css";

const plusJakartaSans = localFont({
  src: [
    {
      path: "./fonts/plus-jakarta-sans-400-800-latin.woff2",
      weight: "400 800",
      style: "normal"
    }
  ],
  display: "swap",
  variable: "--font-plus-jakarta-sans"
});

const beVietnamPro = localFont({
  src: [
    {
      path: "./fonts/be-vietnam-pro-400-latin.woff2",
      weight: "400",
      style: "normal"
    },
    {
      path: "./fonts/be-vietnam-pro-500-latin.woff2",
      weight: "500",
      style: "normal"
    },
    {
      path: "./fonts/be-vietnam-pro-600-latin.woff2",
      weight: "600",
      style: "normal"
    },
    {
      path: "./fonts/be-vietnam-pro-700-latin.woff2",
      weight: "700",
      style: "normal"
    },
    {
      path: "./fonts/be-vietnam-pro-800-latin.woff2",
      weight: "800",
      style: "normal"
    }
  ],
  display: "swap",
  variable: "--font-be-vietnam-pro"
});

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
        url: "/og-image.png",
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
    images: ["/og-image.png"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${plusJakartaSans.variable} ${beVietnamPro.variable}`}>
        <TopNavigation />
        {children}
      </body>
    </html>
  );
}
