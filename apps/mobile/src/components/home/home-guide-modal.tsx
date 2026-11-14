import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import ModalSafeAreaView from "@/components/modal-safe-area-view";
import { HOME_GUIDE_STEPS } from "./home-helpers";
import { styles } from "./home-styles";

// 학습 가이드. 옛 홈의 "가이드 보기"가 열던 창이고, 홈이 로비로 바뀐 뒤에는 내정보에서 연다.
// 홈 칸 묶음(home-sections)은 기기 저장소를 쓰는 모듈까지 불러와서, 내정보가 이 창만 따로 불러오게 떼어 두었다.

interface HomeGuideModalProps {
  isGuideOpen: boolean;
  setIsGuideOpen: (open: boolean) => void;
}

export function HomeGuideModal({
  isGuideOpen,
  setIsGuideOpen
}: HomeGuideModalProps) {
  return (
    <Modal visible={isGuideOpen} animationType="slide" onRequestClose={() => setIsGuideOpen(false)}>
      <ModalSafeAreaView style={styles.guideModalRoot}>
        <View style={styles.guideModalHeader}>
          <View style={styles.guideModalHeaderText}>
            <Text style={styles.guideModalTitle}>바로 보는 학습 가이드</Text>
          </View>
          <Pressable style={styles.guideModalCloseButton} onPress={() => setIsGuideOpen(false)}>
            <Text style={styles.guideModalCloseText}>닫기</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.guideModalScroll}
          contentContainerStyle={styles.guideModalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.guideLeadText}>질문 선택, 코치 도움, 피드백까지 한 흐름으로 이어집니다.</Text>

          <View style={styles.guideStepList}>
            {HOME_GUIDE_STEPS.map((step, index) => (
              <View key={step.title} style={styles.guideStepCard}>
                <View style={styles.guideStepIndex}>
                  <Text style={styles.guideStepIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.guideStepCopy}>
                  <Text style={styles.guideStepTitle}>{step.title}</Text>
                  <Text style={styles.guideStepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.guideTipCard}>
            <Text style={styles.guideTipTitle}>작게 시작하는 게 가장 좋아요.</Text>
            <Text style={styles.guideTipBody}>
              완벽하게 길게 쓰려고 하기보다, 짧게 먼저 쓰고 AI 코치와 피드백으로 한 번 더 다듬는 방식이 가장 안정적으로 늘어요.
            </Text>
          </View>
        </ScrollView>
      </ModalSafeAreaView>
    </Modal>
  );
}
