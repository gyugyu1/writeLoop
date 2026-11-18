import { useLocalSearchParams } from "expo-router";
import DiaryEntryScreen from "@/components/diary-entry-screen";
import { useVillageBgmWritingScreen } from "@/lib/audio/use-village-bgm-writing";

export default function DiaryEntryRoute() {
  // 마을에서 열었으면 마을 배경음악을 낮춰 이어 간다
  useVillageBgmWritingScreen();
  const params = useLocalSearchParams<{ entryId?: string | string[] }>();
  const entryId = Array.isArray(params.entryId) ? params.entryId[0] ?? "" : params.entryId ?? "";

  return <DiaryEntryScreen initialEntryId={entryId || null} />;
}
