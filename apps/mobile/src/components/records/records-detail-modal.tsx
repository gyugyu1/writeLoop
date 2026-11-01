import { useMemo } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import { VisiblePracticeFeedbackContent } from "@/components/visible-practice-feedback-content";
import { getDifficultyLabel } from "@/lib/difficulty";
import type { HistorySession } from "@/lib/types";
import {
  getLatestAttempt,
  formatHistoryTime,
  getHistoryWordCount,
  getAttemptLabel,
  getAttemptCardLabel
} from "./records-helpers";
import { styles } from "./records-styles";

// 작문 기록 상세 모달: 시도 순서대로 문장과 피드백, 닫기와 이어 쓰기.
export type HistorySessionDetailModalProps = {
  onClose: () => void;
  onResume: (session: HistorySession) => void;
  session: HistorySession | null;
};

export function HistorySessionDetailModal({
  onClose,
  onResume,
  session
}: HistorySessionDetailModalProps) {
  const orderedAttempts = useMemo(
    () =>
      session
        ? [...session.attempts].sort(
            (left, right) =>
              left.attemptNo - right.attemptNo ||
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          )
        : [],
    [session]
  );

  const latestAttempt = useMemo(() => (session ? getLatestAttempt(session) : null), [session]);
  if (!session) {
    return null;
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
    >
      <ModalSafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderCopy}>
            <Text style={styles.modalTitle}>질문 기록</Text>
          </View>
          <Pressable
            style={styles.modalCloseButton}
            hitSlop={10}
            onPress={onClose}
          >
            <Text style={styles.modalCloseText}>닫기</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.sessionDetailStack}>
              <View style={styles.promptCard}>
                <View style={styles.chipRow}>
                  <View style={styles.topicChip}>
                    <Text style={styles.topicChipText}>{session.topic}</Text>
                  </View>
                  <View style={styles.neutralChip}>
                    <Text style={styles.neutralChipText}>
                      {getDifficultyLabel(session.difficulty)}
                    </Text>
                  </View>
                  {latestAttempt ? (
                    <View style={styles.neutralChip}>
                      <Text style={styles.neutralChipText}>
                        {getAttemptLabel(latestAttempt.attemptType)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.promptQuestionEn}>{session.questionEn}</Text>
                <Text style={styles.promptQuestionKo}>{session.questionKo}</Text>
              </View>

              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>이 질문에 남긴 답변</Text>
                  <Text style={styles.detailMeta}>{`${orderedAttempts.length}개 시도`}</Text>
                </View>

                <View style={styles.attemptStack}>
                  {orderedAttempts.map((attempt, attemptIndex) => {
                    const isLatest = latestAttempt?.id === attempt.id;

                    return (
                      <View
                        key={attempt.id}
                        style={[
                          styles.attemptCard,
                          attemptIndex > 0 && styles.attemptCardSeparated,
                          attempt.attemptType === "REWRITE"
                            ? styles.attemptCardRewrite
                            : styles.attemptCardInitial
                        ]}
                      >
                        <View style={styles.attemptHeader}>
                          <View style={styles.attemptHeaderCopy}>
                            <View style={styles.attemptChipRow}>
                              <View
                                style={[
                                  styles.attemptTypeChip,
                                  attempt.attemptType === "REWRITE"
                                    ? styles.attemptTypeChipRewrite
                                    : styles.attemptTypeChipInitial
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.attemptTypeChipText,
                                    attempt.attemptType === "REWRITE"
                                      ? styles.attemptTypeChipTextRewrite
                                      : styles.attemptTypeChipTextInitial
                                  ]}
                                >
                                  {getAttemptCardLabel(attempt)}
                                </Text>
                              </View>
                              {isLatest ? (
                                <View style={styles.latestChip}>
                                  <Text style={styles.latestChipText}>마지막 답변</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.attemptMeta}>
                              {`${formatHistoryTime(attempt.createdAt)} · ${getHistoryWordCount(attempt.answerText)}단어`}
                            </Text>
                          </View>

                        </View>

                        <Text style={styles.attemptAnswer}>{attempt.answerText}</Text>
                        <VisiblePracticeFeedbackContent
                          snapshot={attempt.visibleFeedback}
                          learnerAnswer={attempt.answerText}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
              {session.status !== "COMPLETED" && latestAttempt?.visibleFeedback ? (
                <Pressable style={styles.resumeSessionButton} onPress={() => onResume(session)}>
                  <Text style={styles.resumeSessionButtonText}>
                    {session.status === "READY_TO_FINISH" ? "완료 화면으로 이어가기" : "이어서 다시 쓰기"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
        </ScrollView>
      </ModalSafeAreaView>
    </Modal>
  );
}
