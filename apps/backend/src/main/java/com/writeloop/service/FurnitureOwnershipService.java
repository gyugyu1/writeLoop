package com.writeloop.service;

import com.writeloop.persistence.HomeShoppingOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 계정이 가진 로비 가구 개수(치울 수 있는 종류만). 처음 배치 몫과 라룹 홈쇼핑에서 산 개수를 더한다.
 * 장소가 딸린 가구(책상·책장·게시판·창문)는 세지 않는다. 배치 검사가 종류마다 정확히 하나를 따로 본다.
 */
@Service
@RequiredArgsConstructor
public class FurnitureOwnershipService {

    /** 처음 배치(앱 DEFAULT_LOBBY_LAYOUT)에 있는 치울 수 있는 가구. 모든 계정이 처음부터 가진 것으로 친다. */
    static final Map<String, Integer> STARTER_COUNTS = starterCounts();

    private final HomeShoppingOrderRepository orderRepository;

    /** 종류마다 가진 개수. 없는 종류는 0이다(맵에 없을 수 있다). */
    public Map<String, Integer> ownedCounts(Long userId) {
        Map<String, Integer> owned = new HashMap<>(STARTER_COUNTS);
        for (HomeShoppingOrderRepository.TypeCount bought : orderRepository.countByType(userId)) {
            owned.merge(bought.getType(), Math.toIntExact(bought.getCount()), Integer::sum);
        }
        return owned;
    }

    private static Map<String, Integer> starterCounts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("wardrobe", 1);
        counts.put("rug", 1);
        counts.put("lamp", 1);
        return Map.copyOf(counts);
    }
}
