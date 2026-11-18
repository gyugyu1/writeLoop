import { NavigationContext } from "@react-navigation/native";
import { createContext, useContext, useEffect } from "react";
import { setVillageBgmWriting } from "./village-bgm";

/** 화면 이동 정보가 없을 때(내비게이션 밖에서 그린 화면) 쓰는 빈 문맥. */
const NoNavigation = createContext<undefined>(undefined);

/**
 * 영작 화면(질문에 답하기 흐름, 영어일기, 지금 생각나는대로)이 초점을 얻고 잃을 때 마을 배경음악에 알린다.
 * 마을에서 연 영작 화면이면 배경음악을 낮춰 이어 가고, 그 밖에서 열었으면 아무것도 틀지 않는다(village-bgm).
 * 화면 이동 정보가 없으면 화면이 붙어 있는 동안을 초점이 있는 것으로 본다.
 */
export function useVillageBgmWritingScreen(): void {
  const navigation = useContext((NavigationContext as typeof NavigationContext | undefined) ?? (NoNavigation as unknown as typeof NavigationContext));
  useEffect(() => {
    let open = false;
    const set = (next: boolean) => {
      if (open === next) return;
      open = next;
      setVillageBgmWriting(next);
    };
    if (!navigation) {
      set(true);
      return () => set(false);
    }
    if (navigation.isFocused()) set(true);
    const offFocus = navigation.addListener("focus", () => set(true));
    const offBlur = navigation.addListener("blur", () => set(false));
    return () => {
      offFocus();
      offBlur();
      set(false);
    };
  }, [navigation]);
}
