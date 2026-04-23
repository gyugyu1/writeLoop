import { useLocalSearchParams } from "expo-router";
import DiaryEntryScreen from "@/components/diary-entry-screen";

export default function DiaryEntryRoute() {
  const params = useLocalSearchParams<{ entryId?: string | string[] }>();
  const entryId = Array.isArray(params.entryId) ? params.entryId[0] ?? "" : params.entryId ?? "";

  return <DiaryEntryScreen initialEntryId={entryId || null} />;
}
