import type { Metadata } from "next";
import { TopNavigation } from "../components/top-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "writeLoop",
  description: "한국인 학습자를 위한 영어 문답 학습 앱"
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
