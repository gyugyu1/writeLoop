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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
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

    /** 방의 가로(x)·깊이(z), 칸 단위(앱 engine.ts의 ROOM). */
    static final double ROOM_WIDTH = 8;
    static final double ROOM_DEPTH = 11;

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
    private static final List<String> WALLS = List.of("back", "left", "right");

    /** 가구를 두는 곳: 바닥(바닥형·덮개형), 벽, 받침 가구 위(탁상형). */
    private enum Mount { FLOOR, WALL, TABLETOP }

    /**
     * 아는 가구 종류(앱 furniture-catalog.ts): 두는 곳, 장소가 딸려 배치에 정확히 하나 있어야 하는지,
     * 윗면의 소품 자리 수(차지한 칸 수, 윗면이 없으면 0).
     */
    private record FurnitureKind(Mount mount, boolean place, int slots) {
    }

    private static final Map<String, FurnitureKind> KINDS = Map.ofEntries(
            Map.entry("desk", new FurnitureKind(Mount.FLOOR, true, 3)),
            Map.entry("bookcase", new FurnitureKind(Mount.FLOOR, true, 0)),
            Map.entry("wardrobe", new FurnitureKind(Mount.FLOOR, false, 0)),
            Map.entry("rug", new FurnitureKind(Mount.FLOOR, false, 0)),
            Map.entry("lamp", new FurnitureKind(Mount.TABLETOP, false, 0)),
            Map.entry("bed", new FurnitureKind(Mount.FLOOR, false, 0)),
            Map.entry("nightstand", new FurnitureKind(Mount.FLOOR, false, 1)),
            Map.entry("floorLamp", new FurnitureKind(Mount.FLOOR, false, 0)),
            Map.entry("plant", new FurnitureKind(Mount.FLOOR, false, 0)),
            Map.entry("smallPlant", new FurnitureKind(Mount.TABLETOP, false, 0)),
            Map.entry("books", new FurnitureKind(Mount.TABLETOP, false, 0)),
            Map.entry("board", new FurnitureKind(Mount.WALL, true, 0)),
            Map.entry("window", new FurnitureKind(Mount.WALL, true, 0)),
            Map.entry("frame", new FurnitureKind(Mount.WALL, false, 0))
    );

    private final LobbyLayoutRepository lobbyLayoutRepository;
    private final ObjectMapper objectMapper;

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
        LobbyLayoutDto layout = parse(request);
        String layoutJson = writeJson(new StoredLayout(layout.items(), layout.stored()));
        lobbyLayoutRepository.upsert(userId, layout.version(), layoutJson, Instant.now());
        return layout;
    }

    private LobbyLayoutDto parse(JsonNode request) {
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
            LobbyLayoutDto.Item next = parseItem(item);
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

    private LobbyLayoutDto.Item parseItem(JsonNode item) {
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
            return new LobbyLayoutDto.Item(id.textValue(), type.textValue(), null, parseWallSpot(item.get("wall")));
        }
        requireObjectWithKeys(item, FLOOR_ITEM_KEYS);
        return new LobbyLayoutDto.Item(id.textValue(), type.textValue(), parseFloorSpot(item.get("floor")), null);
    }

    private LobbyLayoutDto.FloorSpot parseFloorSpot(JsonNode piece) {
        requireObjectWithKeys(piece, FLOOR_SPOT_KEYS);
        double x = requireWithin(piece.get("x"), ROOM_WIDTH);
        double z = requireWithin(piece.get("z"), ROOM_DEPTH);
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

    private LobbyLayoutDto.WallSpot parseWallSpot(JsonNode piece) {
        requireObjectWithKeys(piece, WALL_SPOT_KEYS);
        JsonNode wall = piece.get("wall");
        if (!wall.isTextual() || !WALLS.contains(wall.textValue())) {
            throw invalid("벽은 back·left·right 중 하나여야 해요.");
        }
        double along = requireWithin(piece.get("along"), "back".equals(wall.textValue()) ? ROOM_WIDTH : ROOM_DEPTH);
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
