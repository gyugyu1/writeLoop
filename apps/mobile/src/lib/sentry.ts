import * as Sentry from "@sentry/react-native";

// 오류 추적(ADR-0018). DSN이 없거나 개발 중이면 아무것도 보내지 않는다.
// 학습자 입력과 개인정보는 보내지 않는다: 사용자 정보, IP, 화면 캡처, 콘솔 출력, 주소의 쿼리 문자열을 뺀다.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? "";

export function initSentry() {
  Sentry.init({
    dsn: sentryDsn,
    enabled: sentryDsn !== "" && !__DEV__,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "console") {
        return null;
      }
      const url = breadcrumb.data?.url;
      if (typeof url === "string") {
        return { ...breadcrumb, data: { ...breadcrumb.data, url: stripQuery(url) } };
      }
      return breadcrumb;
    }
  });
}

// 소셜 가입 토큰처럼 쿼리 문자열에 들어가는 값은 기록하지 않는다.
export function stripQuery(url: string) {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

export const wrapWithSentry = Sentry.wrap;
