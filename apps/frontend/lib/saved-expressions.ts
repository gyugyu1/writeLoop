// 저장한 표현을 화면에서 찾고 묶을 때 쓰는 키와 태그 정리.
import type { SavedExpression } from "./types";

export function normalizeSavedExpressionKey(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

export function normalizeExpressionTagList(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
  );
}

export function buildSavedExpressionIdMap(savedExpressions: SavedExpression[]) {
  return savedExpressions.reduce<Record<string, number>>((accumulator, item) => {
    const key = normalizeSavedExpressionKey(item.expression);
    if (key) {
      accumulator[key] = item.id;
    }
    return accumulator;
  }, {});
}
