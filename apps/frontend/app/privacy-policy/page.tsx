import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_POLICY_DOCUMENT } from "../../lib/public-legal-documents";
import styles from "./privacy-policy.module.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: PRIVACY_POLICY_DOCUMENT.subtitle,
  alternates: {
    canonical: "/privacy-policy"
  },
  openGraph: {
    title: "writeLoop 개인정보처리방침",
    description: PRIVACY_POLICY_DOCUMENT.subtitle,
    url: "https://writeloop.kr/privacy-policy",
    type: "article"
  }
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>WriteLoop Policy</p>
          <h1 className={styles.title}>{PRIVACY_POLICY_DOCUMENT.title}</h1>
          <p className={styles.subtitle}>{PRIVACY_POLICY_DOCUMENT.subtitle}</p>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>시행일 {PRIVACY_POLICY_DOCUMENT.effectiveDate}</span>
            <a className={styles.metaLink} href="mailto:lwd33021@naver.com">
              문의하기
            </a>
          </div>
        </section>

        <article className={styles.documentCard}>
          {PRIVACY_POLICY_DOCUMENT.sections.map((section) => (
            <section key={section.title} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>

              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className={styles.paragraph}>
                  {paragraph}
                </p>
              ))}

              {section.bullets ? (
                <ul className={styles.bulletList}>
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className={styles.bulletItem}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <div className={styles.footerNote}>
          <p className={styles.footerText}>
            계정 관련 요청은 앱 또는 웹의 계정 설정 화면에서도 진행할 수 있습니다.
          </p>
          <Link href="/" className={styles.homeLink}>
            writeLoop 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
