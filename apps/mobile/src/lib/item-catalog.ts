import AsyncStorage from "@react-native-async-storage/async-storage";
import { getItemCatalog } from "./api";
import { currentItemCatalog, parseItemCatalog, setItemCatalog, type ItemCatalogData } from "./item-catalog-store";
import { pruneItemFiles } from "./item-files";

// 아이템 목록 받기와 기기 저장. 홈이 보일 때 서울 날짜로 하루 한 번 서버 목록(GET /api/catalog)을 받는다.
// 로그인했으면 받은 목록을 기기에 저장해, 못 받을 때(다음에 켰을 때 포함) 저장해 둔 목록을 쓴다. 손님은 기기에 적지 않는다.
// 한 번도 받지 못했으면 앱에 든 기본값을 쓴다(item-catalog-store). 그릴 줄 아는지(3D 그리기 정보)는 여기서 정하지 않는다.

export { useItemCatalog } from "./item-catalog-store";

const STORAGE_KEY = "writeloop.item-catalog.v1";
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 목록이 가리키는 모델·아이콘 파일의 해시. */
function catalogFileHashes(data: ItemCatalogData): Set<string> {
  const keep = new Set<string>();
  for (const item of data.items) {
    if (item.assets?.model) keep.add(item.assets.model.sha256);
    if (item.assets?.icon) keep.add(item.assets.icon.sha256);
  }
  return keep;
}

/** 마지막으로 받으러 간 서울 날짜. */
let fetchedDay: string | null = null;

function seoulDay(nowMs: number): string {
  return new Date(nowMs + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

/** 기기에 저장해 둔 목록(없거나 읽지 못하면 null). */
async function loadStored(): Promise<ItemCatalogData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === null ? null : parseItemCatalog(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * 홈이 보일 때 부른다. 오늘(서울 날짜) 아직 받으러 가지 않았으면 서버 목록을 받는다.
 * - 받은 목록의 version이 저장해 둔 목록과 같으면 바꾸지 않고 저장해 둔 목록을 쓴다.
 * - 다르면 받은 목록을 쓰고, store가 참(로그인)이면 기기에 저장한다.
 * - 못 받았거나 모양이 틀리면, 아직 쓰는 목록이 없을 때 저장해 둔 목록을 쓴다(없으면 앱 기본값).
 */
export async function refreshItemCatalog(options: { store: boolean }): Promise<void> {
  const day = seoulDay(Date.now());
  if (fetchedDay === day) return;
  fetchedDay = day;
  const stored = await loadStored();
  // 앱을 켠 뒤 처음이면 받기 전에 저장해 둔 목록부터 쓴다
  if (stored && !currentItemCatalog()) setItemCatalog(stored);
  let received: ItemCatalogData | null = null;
  try {
    received = parseItemCatalog(await getItemCatalog());
  } catch {
    received = null;
  }
  if (!received) return;
  if (stored && received.version === stored.version) {
    if (currentItemCatalog()?.version !== stored.version) setItemCatalog(stored);
    return;
  }
  setItemCatalog(received);
  // 새 목록에 없는 모델·아이콘 파일은 기기에서 지운다(받지 못했을 때는 지우지 않는다)
  pruneItemFiles(catalogFileHashes(received));
  if (!options.store) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(received));
  } catch {
    // 이번 화면은 받은 목록을 쓴다. 다음에 켜면 다시 받는다
  }
}
