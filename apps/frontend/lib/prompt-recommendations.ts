// 홈 화면의 관련 질문 추천: 주제가 겹치는 질문을 고르되, 비슷한 질문이 몰리지 않게 섞는다.
import type { Prompt } from "./types";

export function normalizePromptCategory(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function normalizePromptTopicKey(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function getPromptCategoryKey(prompt: Prompt | null | undefined) {
  return (
    normalizePromptTopicKey(prompt?.topicCategory) ||
    normalizePromptTopicKey(prompt?.topic) ||
    (prompt?.id ?? "")
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export function countDistinctPromptCategories(prompts: Prompt[]) {
  return new Set(
    prompts
      .map((prompt) => getPromptCategoryKey(prompt))
      .filter((categoryKey) => categoryKey !== "")
  ).size;
}

export function getPromptCoachCategories(prompt: Prompt | null | undefined) {
  if (!prompt?.coachProfile) {
    return [];
  }

  const categories = [
    prompt.coachProfile.primaryCategory,
    ...(prompt.coachProfile.secondaryCategories ?? [])
  ]
    .map(normalizePromptCategory)
    .filter((category) => category !== "" && category !== "GENERAL");

  return Array.from(new Set(categories));
}

export function getPromptCoachCategoryOverlapScore(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  if (!currentPrompt || !candidate) {
    return 0;
  }

  const currentCategories = getPromptCoachCategories(currentPrompt);
  if (currentCategories.length === 0) {
    return 0;
  }

  const candidateCategories = new Set(getPromptCoachCategories(candidate));
  let score = 0;

  currentCategories.forEach((category, index) => {
    if (candidateCategories.has(category)) {
      score += index === 0 ? 3 : 1;
    }
  });

  return score;
}

export function getPromptTopicMatch(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  const currentCategory = normalizePromptTopicKey(currentPrompt?.topicCategory);
  const candidateCategory = normalizePromptTopicKey(candidate?.topicCategory);
  const currentDetail = normalizePromptTopicKey(currentPrompt?.topicDetail);
  const candidateDetail = normalizePromptTopicKey(candidate?.topicDetail);

  const sameCategory = currentCategory !== "" && currentCategory === candidateCategory;
  const sameTopicDetail =
    sameCategory && currentDetail !== "" && currentDetail === candidateDetail;

  return {
    sameCategory,
    sameTopicDetail
  };
}

export function buildRelatedPromptRecommendations(
  currentPrompt: Prompt | null | undefined,
  candidates: Prompt[],
  selectedPromptId: string
) {
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidate.id !== selectedPromptId &&
      candidates.findIndex((item) => item.id === candidate.id) === index
  );

  if (!currentPrompt) {
    return uniqueCandidates.slice(0, 3);
  }

  const rankedCandidates = uniqueCandidates
    .map((prompt, index) => {
      const topicMatch = getPromptTopicMatch(currentPrompt, prompt);
      const coachCategoryScore = getPromptCoachCategoryOverlapScore(currentPrompt, prompt);
      const sameDifficulty = prompt.difficulty === currentPrompt.difficulty;
      const priority =
        (topicMatch.sameTopicDetail ? 1_000 : 0) +
        (topicMatch.sameCategory ? 100 : 0) +
        (sameDifficulty ? 10 : 0) +
        coachCategoryScore;

      return {
        prompt,
        index,
        sameDifficulty,
        coachCategoryScore,
        ...topicMatch,
        priority
      };
    })
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.index - right.index;
    });

  const sameTopicDetail = rankedCandidates.filter((candidate) => candidate.sameTopicDetail);
  const sameCategory = rankedCandidates.filter(
    (candidate) => candidate.sameCategory && !candidate.sameTopicDetail
  );
  const others = rankedCandidates.filter((candidate) => !candidate.sameCategory);

  const selected: Prompt[] = [];
  const selectedIds = new Set<string>();

  const addCandidate = (candidate?: (typeof rankedCandidates)[number]) => {
    if (!candidate || selectedIds.has(candidate.prompt.id) || selected.length >= 3) {
      return;
    }
    selected.push(candidate.prompt);
    selectedIds.add(candidate.prompt.id);
  };

  addCandidate(sameTopicDetail[0]);
  addCandidate(sameCategory[0]);

  [...sameTopicDetail, ...sameCategory, ...others].forEach((candidate) => addCandidate(candidate));

  return selected.slice(0, 3);
}

export const PROMPT_DIVERSITY_STOPWORDS = new Set([
  "about",
  "after",
  "and",
  "are",
  "because",
  "describe",
  "does",
  "during",
  "each",
  "english",
  "every",
  "explain",
  "favorite",
  "from",
  "have",
  "how",
  "important",
  "into",
  "like",
  "make",
  "matters",
  "one",
  "reach",
  "related",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "usually",
  "want",
  "what",
  "when",
  "which",
  "why",
  "with",
  "year",
  "you",
  "your"
]);

export function extractPromptDiversityTokens(prompt: Prompt | null | undefined) {
  if (!prompt) {
    return [];
  }

  const rawText = [
    prompt.topic,
    prompt.topicCategory,
    prompt.topicDetail,
    prompt.questionEn
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();

  const tokens = rawText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) => token.length >= 3 && !PROMPT_DIVERSITY_STOPWORDS.has(token)
    );

  return Array.from(new Set(tokens));
}

export function getPromptSharedTokenCount(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  if (!currentPrompt || !candidate) {
    return 0;
  }

  const currentTokens = new Set(extractPromptDiversityTokens(currentPrompt));
  let sharedCount = 0;

  for (const token of extractPromptDiversityTokens(candidate)) {
    if (currentTokens.has(token)) {
      sharedCount += 1;
    }
  }

  return sharedCount;
}

export function calculatePromptOverlapPenalty(
  currentPrompt: Prompt | null | undefined,
  candidate: Prompt | null | undefined
) {
  if (!currentPrompt || !candidate) {
    return 0;
  }

  const topicMatch = getPromptTopicMatch(currentPrompt, candidate);
  const coachCategoryScore = getPromptCoachCategoryOverlapScore(currentPrompt, candidate);
  const sharedTokenCount = getPromptSharedTokenCount(currentPrompt, candidate);
  const sameTopic =
    normalizePromptTopicKey(currentPrompt.topic) !== "" &&
    normalizePromptTopicKey(currentPrompt.topic) === normalizePromptTopicKey(candidate.topic);

  return (
    (sameTopic ? 8_000 : 0) +
    (topicMatch.sameTopicDetail ? 4_000 : 0) +
    (topicMatch.sameCategory ? 1_000 : 0) +
    coachCategoryScore * 180 +
    sharedTokenCount * 55
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

export function pickLeastOverlappingPromptSet(
  currentPrompts: Prompt[],
  candidates: Prompt[],
  seenPromptIds: Iterable<string>,
  desiredCount: number
) {
  const currentPromptIds = new Set(currentPrompts.map((prompt) => prompt.id));
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      !currentPromptIds.has(candidate.id) &&
      candidates.findIndex((item) => item.id === candidate.id) === index
  );

  if (uniqueCandidates.length < desiredCount) {
    return [];
  }

  const selected: Prompt[] = [];
  const seenSet = new Set(seenPromptIds);
  const selectedCategoryKeys = new Set<string>();
  const remaining = [...uniqueCandidates];

  while (selected.length < desiredCount && remaining.length > 0) {
    const eligibleCandidates = remaining.filter(
      (candidate) => !selectedCategoryKeys.has(getPromptCategoryKey(candidate))
    );

    if (eligibleCandidates.length === 0) {
      break;
    }

    const anchorPrompts = [...currentPrompts, ...selected];
    const nextPrompt =
      eligibleCandidates
        .map((candidate, index) => ({
          candidate,
          index,
          seenPenalty: seenSet.has(candidate.id) ? 1 : 0,
          overlapPenalty: anchorPrompts.reduce(
            (sum, anchorPrompt) => sum + calculatePromptOverlapPenalty(anchorPrompt, candidate),
            0
          )
        }))
        .sort((left, right) => {
          if (left.seenPenalty !== right.seenPenalty) {
            return left.seenPenalty - right.seenPenalty;
          }

          if (left.overlapPenalty !== right.overlapPenalty) {
            return left.overlapPenalty - right.overlapPenalty;
          }

          return left.index - right.index;
        })[0]?.candidate ?? null;

    if (!nextPrompt) {
      break;
    }

    selected.push(nextPrompt);
    selectedCategoryKeys.add(getPromptCategoryKey(nextPrompt));
    const nextPromptIndex = remaining.findIndex((prompt) => prompt.id === nextPrompt.id);
    if (nextPromptIndex >= 0) {
      remaining.splice(nextPromptIndex, 1);
    }
  }

  return selected.length === desiredCount ? selected : [];
}
