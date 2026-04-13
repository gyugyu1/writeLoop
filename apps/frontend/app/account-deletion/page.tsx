import type { Metadata } from "next";
import Link from "next/link";
import { ACCOUNT_DELETION_DOCUMENT } from "../../lib/public-legal-documents";
import styles from "./account-deletion.module.css";

export const dynamic = "force-static";

const deleteStartHref = "/login?returnTo=%2Fme%3Ftab%3Daccount%23account-delete-section";
const accountPageHref = "/me?tab=account#account-delete-section";

export const metadata: Metadata = {
  title: "계정 삭제 안내",
  description: ACCOUNT_DELETION_DOCUMENT.subtitle,
  alternates: {
    canonical: "/account-deletion"
  },
  openGraph: {
    title: "writeLoop 계정 삭제 안내",
    description: ACCOUNT_DELETION_DOCUMENT.subtitle,
    url: "https://writeloop.kr/account-deletion",
    type: "article"
  }
};

export default function AccountDeletionPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>WriteLoop Support</p>
          <h1 className={styles.title}>{ACCOUNT_DELETION_DOCUMENT.title}</h1>
          <p className={styles.subtitle}>{ACCOUNT_DELETION_DOCUMENT.subtitle}</p>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>안내 기준일 {ACCOUNT_DELETION_DOCUMENT.effectiveDate}</span>
            <a className={styles.metaLink} href="mailto:lwd33021@naver.com">
              이메일 문의
            </a>
          </div>
        </section>

        <section className={styles.actionCard}>
          <div className={styles.actionCopy}>
            <h2 className={styles.actionTitle}>Play 제출용 계정 삭제 경로</h2>
            <p className={styles.actionDescription}>
              아래 버튼으로 로그인 후 계정 설정의 회원탈퇴 영역으로 바로 이동할 수 있습니다.
            </p>
          </div>
          <div className={styles.actionButtons}>
            <Link href={deleteStartHref} className={styles.primaryAction}>
              웹에서 계정 삭제 시작
            </Link>
            <Link href={accountPageHref} className={styles.secondaryAction}>
              계정 설정 바로가기
            </Link>
          </div>
        </section>

        <article className={styles.documentCard}>
          {ACCOUNT_DELETION_DOCUMENT.sections.map((section) => (
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
            개인정보 처리방침도 함께 확인하려면 아래 링크를 이용해 주세요.
          </p>
          <div className={styles.footerLinks}>
            <Link href="/privacy-policy" className={styles.footerLink}>
              개인정보처리방침
            </Link>
            <Link href="/" className={styles.footerLink}>
              writeLoop 홈
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
