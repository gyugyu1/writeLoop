package com.writeloop.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
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
 * 라이트루프 아이템 목록(가구·옷): 서버의 한곳. 백엔드 목록 파일 {@code catalog/items.json}을 시작할 때 한 번 읽는다
 * (DB가 아니다. 아이템을 더할 때 이 파일을 고쳐 배포한다).
 * 홈쇼핑 가격표·옷 부위·배치 검사의 가구 종류·처음 가진 가구와 {@code GET /api/catalog}가 모두 이것을 읽는다.
 */
@Component
public class ItemCatalog {

    static final String RESOURCE = "catalog/items.json";

    /** 앱과 같은 목록. 정적 값으로도 쓴다(서비스의 상수가 이것에서 만들어진다). */
    public static final ItemCatalog DEFAULT = load();

    /** 아이템 하나. 값이 없는 칸은 null(가구의 slot, 팔지 않는 아이템의 price·category 등). */
    public record Item(
            String id,
            String kind,
            String name,
            String shopName,
            String description,
            String category,
            Integer price,
            String slot,
            Furniture furniture,
            Integer starter,
            Boolean alwaysOwned,
            Object assets
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

    /** 서버 검사에 쓰는 가구 정보: 두는 곳(floor·wall·tabletop), 장소가 딸려 배치에 정확히 하나 있어야 하는지, 윗면 소품 자리 수. */
    public record Furniture(String mount, boolean place, int slots) {
    }

    private record Document(List<Item> items) {
    }

    private final List<Item> items;
    private final Map<String, Item> byId;
    private final String version;

    private ItemCatalog(List<Item> items, String version) {
        this.items = List.copyOf(items);
        Map<String, Item> map = new LinkedHashMap<>();
        for (Item item : items) {
            if (map.put(item.id(), item) != null) {
                throw new IllegalStateException("아이템 목록에 같은 id가 두 번 있다: " + item.id());
            }
        }
        this.byId = map;
        this.version = version;
        validate();
    }

    /** Spring 빈은 정적 목록을 그대로 쓴다. */
    public ItemCatalog() {
        this(DEFAULT.items, DEFAULT.version);
    }

    private static ItemCatalog load() {
        try (InputStream in = ItemCatalog.class.getClassLoader().getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("아이템 목록 파일이 없다: " + RESOURCE);
            }
            byte[] bytes = in.readAllBytes();
            ObjectMapper mapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            Document document = mapper.readValue(new String(bytes, StandardCharsets.UTF_8), Document.class);
            return new ItemCatalog(document.items(), versionOf(bytes));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 목록 내용이 바뀌면 바뀌는 글(파일 내용의 SHA-256 앞 16글자). */
    private static String versionOf(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void validate() {
        Integer last = null;
        for (Item item : items) {
            if (!item.isFurniture() && !item.isWearable()) {
                throw new IllegalStateException("모르는 아이템 종류: " + item.id() + " " + item.kind());
            }
            if (item.isFurniture() && item.furniture() == null) {
                throw new IllegalStateException("가구 정보가 없는 가구: " + item.id());
            }
            if (item.isWearable() && item.slot() == null) {
                throw new IllegalStateException("부위가 없는 옷: " + item.id());
            }
            if (item.sold()) {
                if (last != null && item.price() < last) {
                    throw new IllegalStateException("파는 아이템은 가격이 낮은 것부터 적는다: " + item.id());
                }
                last = item.price();
            }
        }
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

    /** 가구 종류 → 서버 검사용 가구 정보. */
    public Map<String, Furniture> furnitureKinds() {
        Map<String, Furniture> kinds = new LinkedHashMap<>();
        for (Item item : items) {
            if (item.isFurniture()) {
                kinds.put(item.id(), item.furniture());
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
