type RefinementExpressionLike = {
  expression: string;
  displayable?: boolean | null;
};

const PLACEHOLDER_PATTERN = /\[[^[\]\r\n]{1,24}\]/;

function normalizeRefinementText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterSuggestedRefinementExpressions<T extends RefinementExpressionLike>(
  expressions: T[] | null | undefined,
  learnerAnswer?: string | null,
  revisedAnswer?: string | null
) {
  if (!expressions || expressions.length === 0) {
    return [];
  }

  const normalizedLearnerAnswer = normalizeRefinementText(learnerAnswer);
  const normalizedRevisedAnswer = normalizeRefinementText(revisedAnswer);
  const seen = new Set<string>();

  return expressions.filter((expression) => {
    if (expression.displayable === false) {
      return false;
    }

    const candidate = expression as T & {
      meaningKo?: string | null;
      guidanceKo?: string | null;
      exampleEn?: string | null;
    };
    if (
      PLACEHOLDER_PATTERN.test(candidate.expression ?? "") ||
      PLACEHOLDER_PATTERN.test(candidate.meaningKo ?? "") ||
      PLACEHOLDER_PATTERN.test(candidate.guidanceKo ?? "") ||
      PLACEHOLDER_PATTERN.test(candidate.exampleEn ?? "")
    ) {
      return false;
    }

    const normalizedExpression = normalizeRefinementText(expression.expression);
    if (!normalizedExpression || seen.has(normalizedExpression)) {
      return false;
    }

    seen.add(normalizedExpression);

    return (
      !normalizedLearnerAnswer.includes(normalizedExpression) &&
      !normalizedRevisedAnswer.includes(normalizedExpression)
    );
  });
}
