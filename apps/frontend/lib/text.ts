// 문자열 정리와 단어 수. 웹 화면 여러 곳에서 쓴다.

export function trimNullable(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = trimNullable(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
