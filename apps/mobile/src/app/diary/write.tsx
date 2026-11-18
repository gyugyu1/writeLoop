import DiaryEntryScreen from "@/components/diary-entry-screen";
import { useVillageBgmWritingScreen } from "@/lib/audio/use-village-bgm-writing";

export default function DiaryWriteScreen() {
  // 마을에서 열었으면 마을 배경음악을 낮춰 이어 간다
  useVillageBgmWritingScreen();
  return <DiaryEntryScreen />;
}
