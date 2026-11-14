package com.writeloop.service;

import com.writeloop.dto.WardrobeDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.WardrobeItemEntity;
import com.writeloop.persistence.WardrobeItemRepository;
import com.writeloop.persistence.WardrobeOutfitEntity;
import com.writeloop.persistence.WardrobeOutfitRepository;
import com.writeloop.persistence.UserEntity;
import com.writeloop.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 라룹이 착용 아이템(캐릭터 꾸미기): 계정마다 가진 아이템과 부위별로 입은 아이템을 저장하고 돌려준다.
 * 아이템 종류와 부위는 아이템 목록 파일(ItemCatalog)에서 읽는다. 부위마다 한 번에 하나만 입는다.
 * 아이템을 얻는 길(홈쇼핑·마을 가게)은 다음 단계에서 생긴다.
 */
@Service
@RequiredArgsConstructor
public class WardrobeService {

    static final String INVALID_CODE = "WARDROBE_INVALID";
    /** 라룹이 고글: 모든 계정이 처음부터 가지고(DB 행 없이), 입은 것을 저장한 적 없으면 입고 있는 얼굴장식. */
    static final String GOGGLES = "goggles";
    static final String INVALID_MESSAGE = "입을 수 없는 아이템이에요";

    /** 아는 착용 아이템 종류와 그 부위: 아이템 목록 파일(ItemCatalog)의 옷. */
    static final Map<String, String> ITEM_SLOTS = ItemCatalog.DEFAULT.wearableSlots();

    static {
        if (!ItemCatalog.DEFAULT.alwaysOwnedWearables().equals(Set.of(GOGGLES))) {
            throw new IllegalStateException("아이템 목록의 늘 가진 옷은 고글 하나여야 한다");
        }
    }

    private final WardrobeItemRepository itemRepository;
    private final WardrobeOutfitRepository outfitRepository;
    private final UserRepository userRepository;

    /** 착용 아이템 종류인지(홈쇼핑이 옷 주문을 가구 주문과 가른다). */
    public static boolean isWearable(String type) {
        return type != null && ITEM_SLOTS.containsKey(type);
    }

    /** 가진 착용 아이템 종류들(홈쇼핑에서 산 것. 늘 가진 고글은 넣지 않는다). */
    @Transactional(readOnly = true)
    public Set<String> ownedTypes(Long userId) {
        return itemRepository.findAllByUserIdOrderByAcquiredAtAscIdAsc(userId).stream()
                .map(WardrobeItemEntity::getItemType)
                .collect(Collectors.toSet());
    }

    /** 착용 아이템 하나를 가진 것에 더한다(홈쇼핑 주문). 같은 종류를 이미 가졌는지는 부르는 쪽이 먼저 본다(표의 유일 키가 한 번 더 막는다). */
    @Transactional
    public void addItem(Long userId, String type, Instant acquiredAt) {
        itemRepository.saveAndFlush(new WardrobeItemEntity(userId, type, acquiredAt));
    }

    @Transactional(readOnly = true)
    public WardrobeDto getWardrobe(Long userId) {
        List<WardrobeItemEntity> items = itemRepository.findAllByUserIdOrderByAcquiredAtAscIdAsc(userId);
        WardrobeOutfitEntity outfit = outfitRepository.findById(userId).orElse(null);
        return toDto(items, outfit, gogglesAcquiredAt(userId));
    }

    /** 고글을 얻은 때: 계정을 만든 때(계정을 못 찾으면 1970-01-01). */
    private Instant gogglesAcquiredAt(Long userId) {
        return userRepository.findById(userId).map(UserEntity::getCreatedAt).orElse(Instant.EPOCH);
    }

    /**
     * 부위별 입을 아이템을 한꺼번에 바꾼다. 가지지 않은 아이템, 모르는 종류, 다른 부위의 아이템이 하나라도 있으면
     * 400 WARDROBE_INVALID이고 아무것도 바꾸지 않는다.
     */
    @Transactional
    public WardrobeDto saveEquipped(Long userId, WardrobeDto.Equipped requested) {
        WardrobeDto.Equipped equipped = requested == null ? new WardrobeDto.Equipped(null, null, null, null, null, null, null) : requested;
        List<WardrobeItemEntity> items = itemRepository.findAllByUserIdOrderByAcquiredAtAscIdAsc(userId);
        Set<String> owned = items.stream().map(WardrobeItemEntity::getItemType).collect(Collectors.toSet());
        owned.add(GOGGLES);
        Map<String, String> bySlot = asMap(equipped);
        for (Map.Entry<String, String> entry : bySlot.entrySet()) {
            String type = entry.getValue();
            if (type == null) {
                continue;
            }
            if (!entry.getKey().equals(ITEM_SLOTS.get(type)) || !owned.contains(type)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_CODE, INVALID_MESSAGE);
            }
        }
        WardrobeOutfitEntity outfit = outfitRepository.findById(userId).orElseGet(() -> new WardrobeOutfitEntity(userId));
        outfit.wear(
                equipped.hat(), equipped.top(), equipped.bottom(), equipped.shoes(),
                equipped.face(), equipped.back(), equipped.accessory(), Instant.now()
        );
        outfitRepository.save(outfit);
        return toDto(items, outfit, gogglesAcquiredAt(userId));
    }

    private static Map<String, String> asMap(WardrobeDto.Equipped equipped) {
        Map<String, String> bySlot = new LinkedHashMap<>();
        bySlot.put("hat", equipped.hat());
        bySlot.put("top", equipped.top());
        bySlot.put("bottom", equipped.bottom());
        bySlot.put("shoes", equipped.shoes());
        bySlot.put("face", equipped.face());
        bySlot.put("back", equipped.back());
        bySlot.put("accessory", equipped.accessory());
        return bySlot;
    }

    private static WardrobeDto toDto(List<WardrobeItemEntity> items, WardrobeOutfitEntity outfit, Instant gogglesAcquiredAt) {
        // 고글은 늘 맨 앞에 있다. 목록에서 사라진 종류(옛 아이템)는 보이지 않는다
        List<WardrobeDto.Item> list = new java.util.ArrayList<>();
        list.add(new WardrobeDto.Item(GOGGLES, ITEM_SLOTS.get(GOGGLES), gogglesAcquiredAt));
        items.stream()
                .filter(item -> ITEM_SLOTS.containsKey(item.getItemType()) && !GOGGLES.equals(item.getItemType()))
                .map(item -> new WardrobeDto.Item(item.getItemType(), ITEM_SLOTS.get(item.getItemType()), item.getAcquiredAt()))
                .forEach(list::add);
        // 입은 것을 저장한 적 없으면 고글을 쓰고 있다
        WardrobeDto.Equipped equipped = outfit == null
                ? new WardrobeDto.Equipped(null, null, null, null, GOGGLES, null, null)
                : new WardrobeDto.Equipped(
                        outfit.getHatItem(), outfit.getTopItem(), outfit.getBottomItem(), outfit.getShoesItem(),
                        outfit.getFaceItem(), outfit.getBackItem(), outfit.getAccessoryItem()
                );
        return new WardrobeDto(List.copyOf(list), equipped);
    }
}
