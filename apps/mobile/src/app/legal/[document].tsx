import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLegalDocument } from "@/lib/legal-documents";

export default function LegalDocumentScreen() {
  const params = useLocalSearchParams<{ document?: string | string[] }>();
  const document = getLegalDocument(params.document);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.ghostButton} onPress={() => router.back()}>
            <Text style={styles.ghostButtonText}>돌아가기</Text>
          </Pressable>
        </View>

        {document ? (
          <>
            <View style={styles.heroSection}>
              <Text style={styles.pageTitle}>{document.title}</Text>
              <View style={styles.pageUnderline} />
              <Text style={styles.subtitle}>{document.subtitle}</Text>
              <Text style={styles.effectiveDate}>시행일 {document.effectiveDate}</Text>
            </View>

            <View style={styles.panel}>
              {document.sections.map((section) => (
                <View key={section.title} style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>

                  {section.paragraphs?.map((paragraph) => (
                    <Text key={paragraph} style={styles.paragraph}>
                      {paragraph}
                    </Text>
                  ))}

                  {section.bullets?.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>문서를 찾지 못했어요</Text>
            <Text style={styles.emptyBody}>요청한 안내 문서가 없어요. 다시 열어 주세요.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F2EB"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 18
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-start"
  },
  ghostButton: {
    borderRadius: 999,
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E7D7C4",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#75624B"
  },
  heroSection: {
    gap: 10
  },
  pageTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "900",
    letterSpacing: -1.8,
    color: "#232128"
  },
  pageUnderline: {
    width: 170,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#F2A14A"
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6E6153"
  },
  effectiveDate: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8E7759"
  },
  panel: {
    gap: 14
  },
  sectionCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#E9DACC",
    gap: 10
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#2B2620"
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: "#5D5042"
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E38B12",
    marginTop: 8
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: "#5D5042"
  },
  emptyCard: {
    marginTop: 20,
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#E9DACC",
    gap: 8
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#2B2620"
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6E6153"
  }
});
