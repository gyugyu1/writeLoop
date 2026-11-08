package com.writeloop.service;

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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 모바일 홈 로비의 가구 배치를 계정마다 하나 저장하고 돌려준다.
 * 서버는 배치의 모양(아는 가구가 빠짐없이 있는지, 방 안인지, 방향·벽 값)만 검사한다.
 * 가구끼리 겹치는지와 장소로 가는 길이 막히는지는 앱의 편집 화면이 막는다.
 */
@Service
@RequiredArgsConstructor
public class LobbyLayoutService {

    /** 지금 아는 배치 모양 버전. 모양이 바뀌면 올리고 옛 버전을 읽는 방법을 정한다. */
    static final int SHAPE_VERSION = 1;

    /** 방의 가로(x)·깊이(z), 칸 단위(앱 engine.ts의 ROOM). */
    static final double ROOM_WIDTH = 8;
    static final double ROOM_DEPTH = 11;

    private static final List<String> LAYOUT_KEYS = List.of("version", "floor", "wall");
    private static final List<String> FLOOR_PIECES = List.of("desk", "bookcase", "wardrobe", "rug");
    private static final List<String> FLOOR_PIECE_KEYS = List.of("x", "z", "facing");
    private static final List<String> WALL_PIECES = List.of("board", "window");
    private static final List<String> WALL_PIECE_KEYS = List.of("wall", "along");
    private static final List<String> WALLS = List.of("back", "left", "right");

    private final LobbyLayoutRepository lobbyLayoutRepository;
    private final ObjectMapper objectMapper;

    /** 저장한 배치. 저장한 적이 없으면 null이다. */
    @Transactional(readOnly = true)
    public LobbyLayoutDto getLayout(Long userId) {
        return lobbyLayoutRepository.findByUserId(userId)
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional
    public LobbyLayoutDto saveLayout(Long userId, JsonNode request) {
        LobbyLayoutDto layout = parse(request);
        String layoutJson = writeJson(new StoredLayout(layout.floor(), layout.wall()));
        lobbyLayoutRepository.upsert(userId, layout.version(), layoutJson, Instant.now());
        return layout;
    }

    private LobbyLayoutDto parse(JsonNode request) {
        requireObjectWithKeys(request, LAYOUT_KEYS);
        JsonNode version = request.get("version");
        if (!version.isIntegralNumber() || !version.canConvertToInt() || version.intValue() != SHAPE_VERSION) {
            throw invalid("모르는 배치 모양 버전이에요.");
        }

        JsonNode floor = request.get("floor");
        requireObjectWithKeys(floor, FLOOR_PIECES);
        LobbyLayoutDto.Floor parsedFloor = new LobbyLayoutDto.Floor(
                parseFloorPiece(floor.get("desk")),
                parseFloorPiece(floor.get("bookcase")),
                parseFloorPiece(floor.get("wardrobe")),
                parseFloorPiece(floor.get("rug"))
        );

        JsonNode wall = request.get("wall");
        requireObjectWithKeys(wall, WALL_PIECES);
        LobbyLayoutDto.Wall parsedWall = new LobbyLayoutDto.Wall(
                parseWallPiece(wall.get("board")),
                parseWallPiece(wall.get("window"))
        );
        return new LobbyLayoutDto(SHAPE_VERSION, parsedFloor, parsedWall);
    }

    private LobbyLayoutDto.FloorPiece parseFloorPiece(JsonNode piece) {
        requireObjectWithKeys(piece, FLOOR_PIECE_KEYS);
        double x = requireWithin(piece.get("x"), ROOM_WIDTH);
        double z = requireWithin(piece.get("z"), ROOM_DEPTH);
        JsonNode facing = piece.get("facing");
        if (!facing.isIntegralNumber() || !facing.canConvertToInt() || facing.intValue() < 0 || facing.intValue() > 3) {
            throw invalid("가구 방향은 0~3 중 하나여야 해요.");
        }
        return new LobbyLayoutDto.FloorPiece(x, z, facing.intValue());
    }

    private LobbyLayoutDto.WallPiece parseWallPiece(JsonNode piece) {
        requireObjectWithKeys(piece, WALL_PIECE_KEYS);
        JsonNode wall = piece.get("wall");
        if (!wall.isTextual() || !WALLS.contains(wall.textValue())) {
            throw invalid("벽은 back·left·right 중 하나여야 해요.");
        }
        double along = requireWithin(piece.get("along"), "back".equals(wall.textValue()) ? ROOM_WIDTH : ROOM_DEPTH);
        return new LobbyLayoutDto.WallPiece(wall.textValue(), along);
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
            return new LobbyLayoutDto(entity.getShapeVersion(), stored.floor(), stored.wall());
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

    /** DB에 두는 배치. 모양 버전은 열로 따로 둔다. */
    record StoredLayout(LobbyLayoutDto.Floor floor, LobbyLayoutDto.Wall wall) {
    }
}
