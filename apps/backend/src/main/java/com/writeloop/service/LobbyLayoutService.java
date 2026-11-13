package com.writeloop.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.LobbyLayoutDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.LobbyLayoutEntity;
import com.writeloop.persistence.LobbyLayoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 모바일 홈 로비의 가구 배치를 계정마다 하나 저장하고 돌려준다.
 * 서버는 배치의 모양(아는 종류인지, 종류에 맞는 자리가 방 안인지, 방향·벽 값, id가 겹치지 않는지, 장소 가구가 하나씩 있는지,
 * 보관함에 치울 수 있는 종류만 있는지, 탁상형 소품이 방의 받침 가구에 있는 자리에 하나씩 올라 있는지)만 검사한다.
 * 가구끼리 겹치는지와 장소로 가는 길이 막히는지는 앱의 편집 화면이 막는다.
 */
@Service
@RequiredArgsConstructor
public class LobbyLayoutService {

    /** 지금 아는 배치 모양 버전. 2: 가구 인스턴스 목록. 옛 버전(1)으로 저장된 배치는 없는 것으로 본다. */
    static final int SHAPE_VERSION = 2;


    /** 한 배치에 둘 수 있는 가구 수(방과 보관함을 합친 수). */
    static final int MAX_ITEMS = 40;

    private static final Pattern ITEM_ID = Pattern.compile("[A-Za-z0-9_-]{1,40}");
    private static final List<String> LAYOUT_KEYS = List.of("version", "items");
    private static final List<String> LAYOUT_KEYS_WITH_STORED = List.of("version", "items", "stored");
    private static final List<String> STORED_ITEM_KEYS = List.of("id", "type");
    private static final List<String> FLOOR_ITEM_KEYS = List.of("id", "type", "floor");
    private static final List<String> WALL_ITEM_KEYS = List.of("id", "type", "wall");
    private static final List<String> TABLETOP_ITEM_KEYS = List.of("id", "type", "on");
    private static final List<String> FLOOR_SPOT_KEYS = List.of("x", "z", "facing");
    private static final List<String> WALL_SPOT_KEYS = List.of("wall", "along");
    private static final List<String> TABLETOP_SPOT_KEYS = List.of("parent", "slot", "facing");

    /** 가구를 두는 곳: 바닥(바닥형·덮개형), 벽, 받침 가구 위(탁상형). */
    private enum Mount { FLOOR, WALL, TABLETOP }

    /**
     * 아는 가구 종류(아이템 목록 파일 ItemCatalog의 가구): 두는 곳, 장소가 딸려 배치에 정확히 하나 있어야 하는지,
     * 윗면의 소품 자리 수(차지한 칸 수, 윗면이 없으면 0).
     */
    private record FurnitureKind(Mount mount, boolean place, int slots) {
    }

    private static final Map<String, FurnitureKind> KINDS = furnitureKinds();

    private static Map<String, FurnitureKind> furnitureKinds() {
        Map<String, FurnitureKind> kinds = new LinkedHashMap<>();
        ItemCatalog.DEFAULT.furnitureKinds().forEach((type, furniture) -> kinds.put(type, new FurnitureKind(
                switch (furniture.mount()) {
                    case "floor" -> Mount.FLOOR;
                    case "wall" -> Mount.WALL;
                    case "tabletop" -> Mount.TABLETOP;
                    default -> throw new IllegalStateException("모르는 가구 두는 곳: " + type + " " + furniture.mount());
                },
                furniture.place(),
                furniture.slots()
        )));
        return Map.copyOf(kinds);
    }

    private final LobbyLayoutRepository lobbyLayoutRepository;
    private final ObjectMapper objectMapper;

    /** 가진 가구 개수. 있으면 저장할 때 종류마다 가진 개수를 넘지 않는지 본다(운영 빈에서는 늘 있다). */
    @Autowired(required = false)
    private FurnitureOwnershipService furnitureOwnershipService;

    /** 있으면 배치를 저장할 때 홈쇼핑 주문과 같은 계정 잠금을 잡는다(운영 빈에서는 늘 있다). */
    @Autowired(required = false)
    private LoopPointService loopPointService;

    /** 처음 배치(앱 lobby-layout.ts의 DEFAULT_LOBBY_LAYOUT과 같다). 저장된 배치가 없는 계정에 주문한 가구를 더할 때 쓴다. */
    static final LobbyLayoutDto DEFAULT_LAYOUT = new LobbyLayoutDto(SHAPE_VERSION, List.of(
            new LobbyLayoutDto.Item("desk", "desk", new LobbyLayoutDto.FloorSpot(1.5, 5.5, 0), null),
            new LobbyLayoutDto.Item("bookcase", "bookcase", new LobbyLayoutDto.FloorSpot(0.5, 2.5, 1), null),
            new LobbyLayoutDto.Item("wardrobe", "wardrobe", new LobbyLayoutDto.FloorSpot(7.5, 3.5, 3), null),
            new LobbyLayoutDto.Item("rug", "rug", new LobbyLayoutDto.FloorSpot(4.6, 7.2, 0), null),
            new LobbyLayoutDto.Item("board", "board", null, new LobbyLayoutDto.WallSpot("back", 1.8)),
            new LobbyLayoutDto.Item("window", "window", null, new LobbyLayoutDto.WallSpot("back", 4.8)),
            new LobbyLayoutDto.Item("lamp", "lamp", null, null, new LobbyLayoutDto.TabletopSpot("desk", 0, 0))
    ), null);

    /** 저장한 배치. 저장한 적이 없거나 옛 모양 버전이면 null이다. */
    @Transactional(readOnly = true)
    public LobbyLayoutDto getLayout(Long userId) {
        return lobbyLayoutRepository.findByUserId(userId)
                .filter(entity -> entity.getShapeVersion() == SHAPE_VERSION)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public LobbyLayoutDto saveLayout(Long userId, JsonNode request) {
        LobbyLayoutDto layout = parse(request, LobbyRoom.current());
        // 같은 계정의 홈쇼핑 주문(보관함에 가구를 더함)과 겹치지 않게, 주문과 같은 잔액 행 잠금을 이 트랜잭션의 첫 문장으로 잡는다
        if (loopPointService != null) {
            loopPointService.ensureAccount(userId);
            loopPointService.lockAccount(userId);
        }
        requireOwned(userId, layout);
        String layoutJson = writeJson(new StoredLayout(layout.items(), layout.stored()));
        lobbyLayoutRepository.upsert(userId, layout.version(), layoutJson, Instant.now());
        return layout;
    }

    /** 치울 수 있는 종류마다 (방에 놓인 것 + 보관함) 개수가 가진 개수를 넘지 않아야 한다. */
    private void requireOwned(Long userId, LobbyLayoutDto layout) {
        if (furnitureOwnershipService == null) {
            return;
        }
        Map<String, Integer> counts = new HashMap<>();
        for (LobbyLayoutDto.Item item : layout.items()) {
            if (!KINDS.get(item.type()).place()) {
                counts.merge(item.type(), 1, Integer::sum);
            }
        }
        if (layout.stored() != null) {
            for (LobbyLayoutDto.StoredItem item : layout.stored()) {
                counts.merge(item.type(), 1, Integer::sum);
            }
        }
        Map<String, Integer> owned = furnitureOwnershipService.ownedCounts(userId);
        for (Map.Entry<String, Integer> count : counts.entrySet()) {
            if (count.getValue() > owned.getOrDefault(count.getKey(), 0)) {
                throw invalid("가지지 않은 가구가 있어요.");
            }
        }
    }

    /** 주문으로 보관함에 더한 가구: 그 뒤의 배치와 새 가구 id. */
    public record AddedToStorage(LobbyLayoutDto layout, String itemId) {
    }

    /**
     * 주문한 가구를 그 계정 배치의 보관함 맨 뒤에 더해 저장한다. 저장된 배치가 없으면 처음 배치에서 시작한다.
     * 새 id는 "종류-수"이고, 배치(방 + 보관함)의 다른 id와 겹치지 않는 가장 작은 수(1부터)다.
     * 배치가 이미 MAX_ITEMS개면 409 LAYOUT_FULL이다. 부르는 쪽의 트랜잭션 안에서 부른다(홈쇼핑 주문).
     */
    public AddedToStorage addToStorage(Long userId, String type) {
        LobbyLayoutDto current = getLayout(userId);
        if (current == null) {
            current = DEFAULT_LAYOUT;
        }
        List<LobbyLayoutDto.StoredItem> stored = current.stored() == null ? new ArrayList<>() : new ArrayList<>(current.stored());
        if (current.items().size() + stored.size() >= MAX_ITEMS) {
            throw new ApiException(HttpStatus.CONFLICT, "LAYOUT_FULL", "가구는 40개까지 둘 수 있어요.");
        }
        Set<String> ids = new HashSet<>();
        current.items().forEach(item -> ids.add(item.id()));
        stored.forEach(item -> ids.add(item.id()));
        int number = 1;
        while (ids.contains(type + "-" + number)) {
            number++;
        }
        String itemId = type + "-" + number;
        stored.add(new LobbyLayoutDto.StoredItem(itemId, type));
        LobbyLayoutDto next = new LobbyLayoutDto(SHAPE_VERSION, current.items(), List.copyOf(stored));
        lobbyLayoutRepository.upsert(userId, SHAPE_VERSION, writeJson(new StoredLayout(next.items(), next.stored())), Instant.now());
        return new AddedToStorage(next, itemId);
    }

    /** 배치 본문을 그 방(크기·걸 수 있는 벽) 기준으로 검사해 읽는다. 저장은 지금 방으로 검사한다. */
    LobbyLayoutDto parse(JsonNode request, LobbyRoom room) {
        // 보관함(stored)은 없어도 된다
        requireObjectWithKeys(request, request != null && request.has("stored") ? LAYOUT_KEYS_WITH_STORED : LAYOUT_KEYS);
        JsonNode version = request.get("version");
        if (!version.isIntegralNumber() || !version.canConvertToInt() || version.intValue() != SHAPE_VERSION) {
            throw invalid("모르는 배치 모양 버전이에요.");
        }
        JsonNode items = request.get("items");
        if (!items.isArray() || items.isEmpty() || items.size() > MAX_ITEMS) {
            throw invalid("가구 목록이 맞지 않아요.");
        }
        List<LobbyLayoutDto.Item> parsed = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        Map<String, Integer> placeCounts = new HashMap<>();
        for (JsonNode item : items) {
            LobbyLayoutDto.Item next = parseItem(item, room);
            if (!ids.add(next.id())) {
                throw invalid("가구 id가 겹쳐요.");
            }
            if (KINDS.get(next.type()).place()) {
                placeCounts.merge(next.type(), 1, Integer::sum);
            }
            parsed.add(next);
        }
        requireTabletopsOnSlots(parsed);
        List<LobbyLayoutDto.StoredItem> stored = request.has("stored") ? parseStored(request.get("stored"), ids, items.size()) : null;
        // 장소가 딸린 가구는 종류마다 정확히 하나다
        for (Map.Entry<String, FurnitureKind> kind : KINDS.entrySet()) {
            if (kind.getValue().place() && placeCounts.getOrDefault(kind.getKey(), 0) != 1) {
                throw invalid("장소가 딸린 가구는 하나씩 있어야 해요.");
            }
        }
        return new LobbyLayoutDto(SHAPE_VERSION, List.copyOf(parsed), stored);
    }

    /** 탁상형 소품은 방에 놓인 받침 가구(윗면이 있는 바닥 가구)의 있는 자리에 올리고, 한 자리에 하나만 둔다. */
    private void requireTabletopsOnSlots(List<LobbyLayoutDto.Item> items) {
        Map<String, LobbyLayoutDto.Item> byId = new HashMap<>();
        for (LobbyLayoutDto.Item item : items) {
            byId.put(item.id(), item);
        }
        Set<String> taken = new HashSet<>();
        for (LobbyLayoutDto.Item item : items) {
            if (item.on() == null) {
                continue;
            }
            LobbyLayoutDto.Item parent = byId.get(item.on().parent());
            if (parent == null || parent.floor() == null || item.on().slot() >= KINDS.get(parent.type()).slots()) {
                throw invalid("소품을 올린 자리가 없어요.");
            }
            if (!taken.add(parent.id() + "#" + item.on().slot())) {
                throw invalid("한 자리에 소품을 둘 이상 올릴 수 없어요.");
            }
        }
    }

    /** 보관함: 치울 수 있는(장소가 없는) 종류만, id는 방의 가구와도 겹치지 않고, 방과 합쳐 MAX_ITEMS개까지다. */
    private List<LobbyLayoutDto.StoredItem> parseStored(JsonNode stored, Set<String> ids, int placedCount) {
        if (!stored.isArray() || placedCount + stored.size() > MAX_ITEMS) {
            throw invalid("보관함 목록이 맞지 않아요.");
        }
        List<LobbyLayoutDto.StoredItem> parsed = new ArrayList<>();
        for (JsonNode item : stored) {
            requireObjectWithKeys(item, STORED_ITEM_KEYS);
            JsonNode id = item.get("id");
            JsonNode type = item.get("type");
            if (!id.isTextual() || !ITEM_ID.matcher(id.textValue()).matches()) {
                throw invalid("가구 id가 맞지 않아요.");
            }
            if (!type.isTextual() || !KINDS.containsKey(type.textValue())) {
                throw invalid("모르는 가구예요.");
            }
            if (KINDS.get(type.textValue()).place()) {
                throw invalid("장소가 딸린 가구는 보관함에 넣을 수 없어요.");
            }
            if (!ids.add(id.textValue())) {
                throw invalid("가구 id가 겹쳐요.");
            }
            parsed.add(new LobbyLayoutDto.StoredItem(id.textValue(), type.textValue()));
        }
        return List.copyOf(parsed);
    }

    private LobbyLayoutDto.Item parseItem(JsonNode item, LobbyRoom room) {
        if (item == null || !item.isObject()) {
            throw invalid("가구 배치 모양이 맞지 않아요.");
        }
        JsonNode id = item.get("id");
        JsonNode type = item.get("type");
        if (id == null || !id.isTextual() || !ITEM_ID.matcher(id.textValue()).matches()) {
            throw invalid("가구 id가 맞지 않아요.");
        }
        if (type == null || !type.isTextual() || !KINDS.containsKey(type.textValue())) {
            throw invalid("모르는 가구예요.");
        }
        Mount mount = KINDS.get(type.textValue()).mount();
        if (mount == Mount.TABLETOP) {
            requireObjectWithKeys(item, TABLETOP_ITEM_KEYS);
            return new LobbyLayoutDto.Item(id.textValue(), type.textValue(), null, null, parseTabletopSpot(item.get("on")));
        }
        if (mount == Mount.WALL) {
            requireObjectWithKeys(item, WALL_ITEM_KEYS);
            return new LobbyLayoutDto.Item(id.textValue(), type.textValue(), null, parseWallSpot(item.get("wall"), room));
        }
        requireObjectWithKeys(item, FLOOR_ITEM_KEYS);
        return new LobbyLayoutDto.Item(id.textValue(), type.textValue(), parseFloorSpot(item.get("floor"), room), null);
    }

    private LobbyLayoutDto.FloorSpot parseFloorSpot(JsonNode piece, LobbyRoom room) {
        requireObjectWithKeys(piece, FLOOR_SPOT_KEYS);
        double x = requireWithin(piece.get("x"), room.width());
        double z = requireWithin(piece.get("z"), room.depth());
        JsonNode facing = piece.get("facing");
        if (!facing.isIntegralNumber() || !facing.canConvertToInt() || facing.intValue() < 0 || facing.intValue() > 3) {
            throw invalid("가구 방향은 0~3 중 하나여야 해요.");
        }
        return new LobbyLayoutDto.FloorSpot(x, z, facing.intValue());
    }

    private LobbyLayoutDto.TabletopSpot parseTabletopSpot(JsonNode piece) {
        requireObjectWithKeys(piece, TABLETOP_SPOT_KEYS);
        JsonNode parent = piece.get("parent");
        if (!parent.isTextual() || !ITEM_ID.matcher(parent.textValue()).matches()) {
            throw invalid("소품을 올린 가구 id가 맞지 않아요.");
        }
        JsonNode slot = piece.get("slot");
        if (!slot.isIntegralNumber() || !slot.canConvertToInt() || slot.intValue() < 0) {
            throw invalid("소품 자리 번호가 맞지 않아요.");
        }
        JsonNode facing = piece.get("facing");
        if (!facing.isIntegralNumber() || !facing.canConvertToInt() || facing.intValue() < 0 || facing.intValue() > 3) {
            throw invalid("가구 방향은 0~3 중 하나여야 해요.");
        }
        return new LobbyLayoutDto.TabletopSpot(parent.textValue(), slot.intValue(), facing.intValue());
    }

    private LobbyLayoutDto.WallSpot parseWallSpot(JsonNode piece, LobbyRoom room) {
        requireObjectWithKeys(piece, WALL_SPOT_KEYS);
        JsonNode wall = piece.get("wall");
        if (!wall.isTextual() || !room.hangWalls().contains(wall.textValue())) {
            throw invalid("벽은 " + String.join("·", room.hangWalls()) + " 중 하나여야 해요.");
        }
        double along = requireWithin(piece.get("along"), room.wallLength(wall.textValue()));
        return new LobbyLayoutDto.WallSpot(wall.textValue(), along);
    }

    private double requireWithin(JsonNode value, double max) {
        if (!value.isNumber() || !Double.isFinite(value.doubleValue())
                || value.doubleValue() < 0 || value.doubleValue() > max) {
            throw invalid("가구 자리가 방 밖이에요.");
        }
        return value.doubleValue();
    }

    /** 객체이고, 키가 정확히 keys와 같아야 한다(모르는 키도, 빠진 키도 없다). */
    private void requireObjectWithKeys(JsonNode node, List<String> keys) {
        if (node == null || !node.isObject()) {
            throw invalid("가구 배치 모양이 맞지 않아요.");
        }
        Set<String> actual = new LinkedHashSet<>();
        node.fieldNames().forEachRemaining(actual::add);
        if (!actual.equals(new LinkedHashSet<>(keys))) {
            throw invalid("가구 배치 모양이 맞지 않아요.");
        }
    }

    private LobbyLayoutDto toDto(LobbyLayoutEntity entity) {
        try {
            StoredLayout stored = objectMapper.readValue(entity.getLayoutJson(), StoredLayout.class);
            return new LobbyLayoutDto(entity.getShapeVersion(), stored.items(), stored.stored());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("저장된 가구 배치를 읽지 못했어요.", exception);
        }
    }

    private String writeJson(StoredLayout layout) {
        try {
            return objectMapper.writeValueAsString(layout);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("가구 배치를 저장하지 못했어요.", exception);
        }
    }

    private ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LOBBY_LAYOUT", message);
    }

    /** DB에 두는 배치. 모양 버전은 열로 따로 둔다. 보관함은 저장할 때 보냈을 때만 있다. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    record StoredLayout(List<LobbyLayoutDto.Item> items, List<LobbyLayoutDto.StoredItem> stored) {
    }
}
