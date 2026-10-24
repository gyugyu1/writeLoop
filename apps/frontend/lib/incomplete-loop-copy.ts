// 이어 쓰기 안내 카드의 문구.
import type { IncompleteLoopStep } from "./incomplete-loop";

export type IncompleteLoopCopy = {
  title: string;
  body: string;
  ctaLabel: string;
  badgeLabel: string;
  icon: string;
};

export function getIncompleteLoopCopy(step: IncompleteLoopStep): IncompleteLoopCopy {
  switch (step) {
    case "feedback":
      return {
        title: "받아둔 피드백이 남아 있어요",
        body: "코치가 남긴 포인트를 확인하고 다음 루프로 자연스럽게 이어가 볼 수 있어요.",
        ctaLabel: "피드백 이어보기",
        badgeLabel: "FEEDBACK",
        icon: "chat"
      };
    case "rewrite":
      return {
        title: "다시쓰기 초안이 남아 있어요",
        body: "방금 다듬던 문장을 이어서 마무리하고 한 번 더 정리해 볼 수 있어요.",
        ctaLabel: "다시 쓰러 가기",
        badgeLabel: "REWRITE",
        icon: "edit_note"
      };
    case "answer":
    default:
      return {
        title: "작성하던 초안이 남아 있어요",
        body: "멈춘 지점부터 바로 이어서 쓰고 오늘의 루프를 계속 진행할 수 있어요.",
        ctaLabel: "이어서 쓰기",
        badgeLabel: "DRAFT",
        icon: "edit"
      };
  }
}

export function formatIncompleteLoopSavedAt(updatedAt: string) {
  const savedAt = new Date(updatedAt);
  if (Number.isNaN(savedAt.getTime())) {
    return "";
  }

  return savedAt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
