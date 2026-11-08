import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLobbyLayout } from "@/lib/api";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

// 홈(로비)에 들어올 때마다 계정에 저장한 가구 배치를 불러온다. 다른 화면에서 돌아올 때도 다시 불러온다(다른 폰에서 바꾼 배치).
// 받기 전과 저장한 배치가 없을 때(모양이 맞지 않을 때 포함)는 처음 배치다.
// 불러오기에 실패하면, 이 계정의 배치를 이미 받았으면 그대로 두고, 아직이면 처음 배치다.

/** 로그인한 사용자의 id. 바뀌면 처음 배치로 돌아가 그 계정의 배치를 새로 불러온다. 로그인 전이면 null(불러오지 않는다). */
export function useLobbyLayout(userId: number | null): LobbyLayout {
  const [layout, setLayout] = useState<LobbyLayout>(DEFAULT_LOBBY_LAYOUT);
  const loadedRef = useRef(false);
  // 계정이 바뀌거나 새로 부르면 늘어난다. 늦게 온 앞 응답을 버린다.
  const requestRef = useRef(0);

  useEffect(() => {
    requestRef.current += 1;
    loadedRef.current = false;
    setLayout(DEFAULT_LOBBY_LAYOUT);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId === null) return;
      requestRef.current += 1;
      const request = requestRef.current;
      const load = async () => {
        const loaded = await getLobbyLayout();
        if (request !== requestRef.current) return;
        loadedRef.current = true;
        setLayout(loaded ?? DEFAULT_LOBBY_LAYOUT);
      };
      load().catch(() => {
        if (request !== requestRef.current || loadedRef.current) return;
        setLayout(DEFAULT_LOBBY_LAYOUT);
      });
    }, [userId])
  );

  return layout;
}
