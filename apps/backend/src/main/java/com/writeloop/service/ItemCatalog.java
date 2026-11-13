package com.writeloop.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 라이트루프 아이템 목록(가구·옷): 서버의 한곳. 백엔드 목록 파일 {@code catalog/items.json}과 그 옆의 모델·아이콘 파일
 * ({@code catalog/files/})을 시작할 때 한 번 읽는다(DB가 아니다. 아이템을 더할 때 이 파일들을 고쳐 배포한다).
 * 홈쇼핑 가격표·옷 부위·배치 검사의 가구 종류·처음 가진 가구와 {@code GET /api/catalog}·파일 API가 모두 이것을 읽는다.
 */
@Component
public class ItemCatalog {

    static final String RESOURCE = "catalog/items.json";
    static final String FILES_DIR = "catalog/files/";
    /** 파일 API의 주소 앞부분. 뒤에 내용 SHA-256(64글자)과 확장자가 붙는다. */
    public static final String FILES_PATH = "/api/catalog/files/";

    /** 앱과 같은 목록. 정적 값으로도 쓴다(서비스의 상수가 이것에서 만들어진다). */
    public static final ItemCatalog DEFAULT = load();

    /**
     * 아이템 하나. 값이 없는 칸은 null(가구의 slot, 팔지 않는 아이템의 price·category 등).
     * draw는 그리기 정보(가구는 앱 furniture-catalog의 값과 같은 모양, 옷은 붙이는 방식·뼈·색·맞춘 몸),
     * files는 목록 파일 옆 폴더 안의 모델·아이콘 파일 이름이다.
     */
    public record Item(
            String id,
            String kind,
            String name,
            String shopName,
            String description,
            String category,
            Integer price,
            String slot,
            JsonNode draw,
            Files files,
            Integer starter,
            Boolean alwaysOwned
    ) {
        public boolean isFurniture() {
            return "furniture".equals(kind);
        }

        public boolean isWearable() {
            return "wearable".equals(kind);
        }

        public boolean sold() {
            return price != null;
        }
    }

    /** 목록 파일 옆 폴더 안의 파일 이름(아이콘은 없을 수 있다). */
    public record Files(String model, String icon) {
    }

    /** 서버 검사에 쓰는 가구 정보(그리기 정보에서 만든다): 두는 곳(floor·wall·tabletop), 장소가 딸렸는지, 윗면 소품 자리 수. */
    public record Furniture(String mount, boolean place, int slots) {
    }

    /** 내려받을 파일 하나: 주소, 내용 SHA-256(소문자 16진수 전체), 크기. */
    public record Asset(String url, String sha256, long bytes) {
    }

    /** 아이템의 모델·아이콘 파일(아이콘은 없을 수 있다). */
    public record Assets(Asset model, Asset icon) {
    }

    /** 파일 API가 주는 파일 하나. */
    public record StoredFile(byte[] content, String contentType) {
    }

    private record Document(List<Item> items) {
    }

    private final List<Item> items;
    private final Map<String, Item> byId;
    private final Map<String, Assets> assetsById;
    /** 파일 API 주소의 마지막 부분(해시.확장자) → 파일. */
    private final Map<String, StoredFile> filesByName;
    private final String version;

    private ItemCatalog(List<Item> items, Map<String, Assets> assetsById, Map<String, StoredFile> filesByName, String version) {
        this.items = List.copyOf(items);
        Map<String, Item> map = new LinkedHashMap<>();
        for (Item item : items) {
            if (map.put(item.id(), item) != null) {
                throw new IllegalStateException("아이템 목록에 같은 id가 두 번 있다: " + item.id());
            }
        }
        this.byId = map;
        this.assetsById = Map.copyOf(assetsById);
        this.filesByName = Map.copyOf(filesByName);
        this.version = version;
        validate();
    }

    /** Spring 빈은 정적 목록을 그대로 쓴다. */
    public ItemCatalog() {
        this(DEFAULT.items, DEFAULT.assetsById, DEFAULT.filesByName, DEFAULT.version);
    }

    private static ItemCatalog load() {
        byte[] catalogBytes = readResource(RESOURCE);
        Document document;
        try {
            ObjectMapper mapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            document = mapper.readValue(new String(catalogBytes, StandardCharsets.UTF_8), Document.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        Map<String, Assets> assets = new LinkedHashMap<>();
        Map<String, StoredFile> files = new LinkedHashMap<>();
        MessageDigest versionDigest = sha256();
        versionDigest.update(catalogBytes);
        for (Item item : document.items()) {
            if (item.files() == null) {
                continue;
            }
            Asset model = asset(item.id(), item.files().model(), files, versionDigest);
            Asset icon = item.files().icon() == null ? null : asset(item.id(), item.files().icon(), files, versionDigest);
            assets.put(item.id(), new Assets(model, icon));
        }
        String version = HexFormat.of().formatHex(versionDigest.digest()).substring(0, 16);
        return new ItemCatalog(document.items(), assets, files, version);
    }

    private static Asset asset(String itemId, String fileName, Map<String, StoredFile> files, MessageDigest versionDigest) {
        if (fileName == null || !fileName.matches("[A-Za-z0-9_-]+\\.(glb|png)")) {
            throw new IllegalStateException("파일 이름이 맞지 않다: " + itemId + " " + fileName);
        }
        byte[] content = readResource(FILES_DIR + fileName);
        String sha256 = HexFormat.of().formatHex(sha256().digest(content));
        String extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        String name = sha256 + "." + extension;
        files.put(name, new StoredFile(content, extension.equals("glb") ? "model/gltf-binary" : "image/png"));
        versionDigest.update(sha256.getBytes(StandardCharsets.US_ASCII));
        return new Asset(FILES_PATH + name, sha256, content.length);
    }

    private static byte[] readResource(String path) {
        try (InputStream in = ItemCatalog.class.getClassLoader().getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("아이템 목록 파일이 없다: " + path);
            }
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * 옷 검사: 부위가 있고, 그리기 정보가 있으면 객체이고 붙이는 방식(attach)이 적혀 있고 맞춘 몸 판(body)이 1 이상의 정수이며 모델 파일이 있어야 한다.
     * 붙이는 방식의 값은 막지 않는다(서버는 그대로 내려 주고, 앱이 모르는 방식이면 그 앱에서 그릴 줄 모르는 옷이 된다). bone이면 붙일 뼈 이름이 있어야 한다.
     * 그리기 정보가 없는 옷은 몸에 그려진 라룹이 고글뿐이고 파일도 없다.
     */
    private static void validateWearable(Item item) {
        if (item.slot() == null) {
            throw new IllegalStateException("부위가 없는 옷: " + item.id());
        }
        JsonNode draw = item.draw();
        if (draw == null || draw.isNull()) {
            if (item.files() != null) {
                throw new IllegalStateException("그리기 정보 없이 파일만 있는 옷: " + item.id());
            }
            return;
        }
        String attach = draw.path("attach").asText();
        boolean shape = draw.isObject()
                && !attach.isEmpty()
                && (!"bone".equals(attach) || !draw.path("bone").asText().isEmpty())
                && draw.path("body").isIntegralNumber() && draw.path("body").asInt() >= 1;
        if (!shape) {
            throw new IllegalStateException("옷 그리기 정보가 맞지 않다: " + item.id());
        }
        if (item.files() == null || item.files().model() == null) {
            throw new IllegalStateException("모델 파일이 없는 옷: " + item.id());
        }
    }

    private void validate() {
        Integer last = null;
        for (Item item : items) {
            if (!item.isFurniture() && !item.isWearable()) {
                throw new IllegalStateException("모르는 아이템 종류: " + item.id() + " " + item.kind());
            }
            if (item.isFurniture()) {
                if (item.draw() == null || !item.draw().isObject()) {
                    throw new IllegalStateException("그리기 정보가 없는 가구: " + item.id());
                }
                if (item.files() == null || item.files().model() == null) {
                    throw new IllegalStateException("모델 파일이 없는 가구: " + item.id());
                }
                furnitureOf(item);
            }
            if (item.isWearable()) {
                validateWearable(item);
            }
            if (item.sold()) {
                if (last != null && item.price() < last) {
                    throw new IllegalStateException("파는 아이템은 가격이 낮은 것부터 적는다: " + item.id());
                }
                last = item.price();
            }
        }
    }

    /** 그리기 정보에서 서버 검사용 가구 정보를 만든다(덮개 cover는 바닥 floor로 본다). */
    static Furniture furnitureOf(Item item) {
        JsonNode draw = item.draw();
        String mount = draw.path("mount").asText();
        String serverMount = switch (mount) {
            case "floor", "cover" -> "floor";
            case "wall", "tabletop" -> mount;
            default -> throw new IllegalStateException("모르는 가구 두는 곳: " + item.id() + " " + mount);
        };
        boolean place = draw.hasNonNull("place");
        int slots = 0;
        JsonNode surface = draw.get("surface");
        if (surface != null && surface.isObject()) {
            JsonNode cells = surface.get("cells");
            slots = cells != null && cells.isArray()
                    ? cells.size()
                    : draw.path("size").path("width").asInt() * draw.path("size").path("depth").asInt();
        }
        return new Furniture(serverMount, place, slots);
    }

    public List<Item> items() {
        return items;
    }

    public Item find(String id) {
        return id == null ? null : byId.get(id);
    }

    public String version() {
        return version;
    }

    /** 아이템의 모델·아이콘 파일. 파일이 없는 아이템(옷 등)은 null. */
    public Assets assetsOf(String id) {
        return assetsById.get(id);
    }

    /** 파일 API 주소의 마지막 부분(해시.확장자)의 파일. 목록에 없으면 null. */
    public StoredFile file(String name) {
        return name == null ? null : filesByName.get(name);
    }

    /** 홈쇼핑에서 파는 아이템(가격이 낮은 것부터 파일 순서). */
    public List<Item> products() {
        List<Item> list = new ArrayList<>();
        for (Item item : items) {
            if (item.sold()) {
                list.add(item);
            }
        }
        return List.copyOf(list);
    }

    /** 옷 종류 → 부위(파일 순서). */
    public Map<String, String> wearableSlots() {
        Map<String, String> slots = new LinkedHashMap<>();
        for (Item item : items) {
            if (item.isWearable()) {
                slots.put(item.id(), item.slot());
            }
        }
        return slots;
    }

    /** 모든 계정이 처음부터 늘 가진 옷(고글). */
    public Set<String> alwaysOwnedWearables() {
        Set<String> set = new LinkedHashSet<>();
        for (Item item : items) {
            if (item.isWearable() && Boolean.TRUE.equals(item.alwaysOwned())) {
                set.add(item.id());
            }
        }
        return set;
    }

    /** 가구 종류 → 서버 검사용 가구 정보(그리기 정보에서 만든다). */
    public Map<String, Furniture> furnitureKinds() {
        Map<String, Furniture> kinds = new LinkedHashMap<>();
        for (Item item : items) {
            if (item.isFurniture()) {
                kinds.put(item.id(), furnitureOf(item));
            }
        }
        return kinds;
    }

    /** 처음 배치에 있어 모든 계정이 처음부터 가진 치울 수 있는 가구와 그 개수. */
    public Map<String, Integer> starterCounts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Item item : items) {
            if (item.isFurniture() && item.starter() != null && item.starter() > 0) {
                counts.put(item.id(), item.starter());
            }
        }
        return counts;
    }
}
