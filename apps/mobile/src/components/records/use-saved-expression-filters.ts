import { useDeferredValue, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  normalizeSavedExpressionTag,
  formatSavedExpressionTagLabel,
  getVisibleSavedExpressionTags,
  normalizeSavedExpressionSearchQuery,
  buildSavedExpressionSearchText
} from "./records-helpers";
import type { SavedExpression } from "@/lib/types";

// 기록 화면의 저장 표현 검색·태그: 검색어 정리, 태그 목록, 보이는 표현과 머리 문구, 사라진 태그 풀기(E5),
// 초기화·태그 고르기. 검색어·태그 상태는 로그아웃 때 E3이 비우므로 화면에 있다.
export function useSavedExpressionFilters({
  savedExpressionSearchQuery,
  savedExpressions,
  selectedSavedExpressionTag,
  setSavedExpressionSearchQuery,
  setSelectedSavedExpressionTag,
  setSelectedSavedExpressionTagAnchorId
}: {
  savedExpressionSearchQuery: string;
  savedExpressions: SavedExpression[];
  selectedSavedExpressionTag: string | null;
  setSavedExpressionSearchQuery: Dispatch<SetStateAction<string>>;
  setSelectedSavedExpressionTag: Dispatch<SetStateAction<string | null>>;
  setSelectedSavedExpressionTagAnchorId: Dispatch<SetStateAction<number | null>>;
}) {
  const deferredSavedExpressionSearchQuery = useDeferredValue(savedExpressionSearchQuery);

  const normalizedSavedExpressionSearch = useMemo(
    () => normalizeSavedExpressionSearchQuery(deferredSavedExpressionSearchQuery),
    [deferredSavedExpressionSearchQuery]
  );
  const savedExpressionTagOptions = useMemo(() => {
    const counts = new Map<string, number>();

    savedExpressions.forEach((item) => {
      getVisibleSavedExpressionTags(item).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((left, right) => {
        const countCompare = right[1] - left[1];
        if (countCompare !== 0) {
          return countCompare;
        }

        return formatSavedExpressionTagLabel(left[0]).localeCompare(
          formatSavedExpressionTagLabel(right[0]),
          "ko"
        );
      })
      .map(([tag, count]) => ({
        tag,
        count,
        label: formatSavedExpressionTagLabel(tag)
      }));
  }, [savedExpressions]);
  const visibleSavedExpressions = useMemo(() => {
    const sortedByLatest = [...savedExpressions].sort((left, right) => {
      const timeCompare = right.lastSavedAt.localeCompare(left.lastSavedAt);
      if (timeCompare !== 0) {
        return timeCompare;
      }

      return right.id - left.id;
    });
    const filteredExpressions = normalizedSavedExpressionSearch
      ? sortedByLatest.filter((item) =>
          buildSavedExpressionSearchText(item).includes(normalizedSavedExpressionSearch)
        )
      : sortedByLatest;

    if (!selectedSavedExpressionTag) {
      return filteredExpressions;
    }

    return [...filteredExpressions].sort((left, right) => {
      const leftMatchesTag = getVisibleSavedExpressionTags(left).includes(selectedSavedExpressionTag);
      const rightMatchesTag = getVisibleSavedExpressionTags(right).includes(selectedSavedExpressionTag);

      if (leftMatchesTag !== rightMatchesTag) {
        return leftMatchesTag ? -1 : 1;
      }

      const timeCompare = right.lastSavedAt.localeCompare(left.lastSavedAt);
      if (timeCompare !== 0) {
        return timeCompare;
      }

      return right.id - left.id;
    });
  }, [normalizedSavedExpressionSearch, savedExpressions, selectedSavedExpressionTag]);
  const savedExpressionSectionMeta = useMemo(() => {
    if (!normalizedSavedExpressionSearch && !selectedSavedExpressionTag) {
      return `${savedExpressions.length}개의 표현`;
    }

    return `${visibleSavedExpressions.length}개 결과 · 전체 ${savedExpressions.length}개`;
  }, [
    normalizedSavedExpressionSearch,
    savedExpressions.length,
    selectedSavedExpressionTag,
    visibleSavedExpressions.length
  ]);

  useEffect(() => {
    if (!selectedSavedExpressionTag) {
      setSelectedSavedExpressionTagAnchorId(null);
      return;
    }

    if (savedExpressionTagOptions.some((option) => option.tag === selectedSavedExpressionTag)) {
      return;
    }

    setSelectedSavedExpressionTag(null);
    setSelectedSavedExpressionTagAnchorId(null);
  }, [
    savedExpressionTagOptions,
    selectedSavedExpressionTag,
    setSelectedSavedExpressionTag,
    setSelectedSavedExpressionTagAnchorId
  ]);

  function handleResetSavedExpressionControls() {
    setSavedExpressionSearchQuery("");
    setSelectedSavedExpressionTag(null);
    setSelectedSavedExpressionTagAnchorId(null);
  }

  function handleSelectSavedExpressionTag(tag: string, anchorSavedExpressionId?: number) {
    const normalizedTag = normalizeSavedExpressionTag(tag);
    if (!normalizedTag) {
      return;
    }

    setSelectedSavedExpressionTag((current) => {
      if (current === normalizedTag) {
        setSelectedSavedExpressionTagAnchorId(null);
        return null;
      }

      setSelectedSavedExpressionTagAnchorId(anchorSavedExpressionId ?? null);
      return normalizedTag;
    });
  }

  const selectedSavedExpressionTagLabel = selectedSavedExpressionTag
    ? formatSavedExpressionTagLabel(selectedSavedExpressionTag)
    : "";

  return {
    handleResetSavedExpressionControls,
    handleSelectSavedExpressionTag,
    normalizedSavedExpressionSearch,
    savedExpressionSectionMeta,
    savedExpressionTagOptions,
    selectedSavedExpressionTagLabel,
    visibleSavedExpressions
  };
}
