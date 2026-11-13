package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 090 ① 서버 아이템 목록, 백엔드 "그대로여야 할 동작". 기준 커밋 613c2d2의 지금 동작을 그대로 기록한다.
 * 이번 변경은 HomeShoppingService.PRODUCTS, WardrobeService.ITEM_SLOTS, LobbyLayoutService.KINDS,
 * FurnitureOwnershipService.STARTER_COUNTS를 한 목록에서 만들게 바꾸므로, 그 네 목록이 정하던 동작을 API로 모두 본다.
 *
 * <ul>
 *   <li>홈쇼핑: 상품 스물여섯의 순서·정가, 응답 모양, 오늘의 방송(서울 날짜 epochDay % 26), 처음 가진 가구, 팔지 않는 종류의 주문 거절.</li>
 *   <li>옷장: 옷 열일곱의 부위(가진 목록의 부위, 맞는 부위만 입기), 모르는 종류 거절.</li>
 *   <li>배치: 가구 열넷의 두는 곳·장소 여부·소품 자리 수, 모르는 종류 거절, 가진 개수 검사.</li>
 * </ul>
 */
class ItemCatalogKeepSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /** 홈쇼핑 상품 순서와 정가(가격이 낮은 것부터, 같은 가격이면 지금 순서). 방송도 이 순서로 돈다. */
    private static final List<String> SHOP_TYPES = List.of(
            "books", "smallPlant", "lamp", "capOrange", "capBlue", "capGreen", "frame", "shortsNavy", "shortsBrown", "shortsRed",
            "plant", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shoesBrown", "shoesRed", "shoesWhite", "mufflerRed",
            "nightstand", "sunglassesBlack", "floorLamp", "necklaceGold", "backpackRed", "rug", "wardrobe", "bed");
    private static final List<Integer> SHOP_PRICES = List.of(
            40, 50, 60, 60, 60, 60, 70, 70, 70, 70, 80, 80, 80, 80, 90, 90, 90, 90, 100, 100, 110, 110, 120, 150, 180, 300);

    /** 처음부터 가진 가구. */
    private static final Map<String, Integer> STARTER = Map.of("wardrobe", 1, "rug", 1, "lamp", 1);

    /** 팔지 않는 옷(고글) 다음에 산 옷 열여섯, 각 부위. */
    private static final List<String[]> SOLD_CLOTHES = List.of(
            new String[] {"capOrange", "hat"},
            new String[] {"tshirtOrange", "top"},
            new String[] {"shortsNavy", "bottom"},
            new String[] {"shoesBrown", "shoes"},
            new String[] {"capBlue", "hat"},
            new String[] {"capGreen", "hat"},
            new String[] {"tshirtWhite", "top"},
            new String[] {"tshirtYellow", "top"},
            new String[] {"shortsBrown", "bottom"},
            new String[] {"shortsRed", "bottom"},
            new String[] {"shoesRed", "shoes"},
            new String[] {"shoesWhite", "shoes"},
            new String[] {"sunglassesBlack", "face"},
            new String[] {"backpackRed", "back"},
            new String[] {"mufflerRed", "accessory"},
            new String[] {"necklaceGold", "accessory"});

    private static final List<String> WEAR_SLOTS = List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory");

    /** 장소가 딸린 가구(배치에 정확히 하나, 보관함 안 됨, 가진 개수로 세지 않음). */
    private static final List<String> PLACE_KINDS = List.of("desk", "bookcase", "board", "window");

    /** 치울 수 있는 가구 열(보관함에 넣을 수 있다). */
    private static final List<String> STORABLE_KINDS = List.of(
            "wardrobe", "rug", "lamp", "bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame");

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // 홈쇼핑
    // =====================================================================

    @Test
    void k1_shopListOrderPricesAndShape() throws Exception {
        TestUser user = newUser("k1");

        HttpResponse<String> response = send(user, "GET", "/api/home-shopping", null);

        assertThat(response.statusCode()).as("K1 GET /api/home-shopping, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(fieldNames(body)).as("K1 top keys").isEqualTo(set("balance", "broadcast", "items"));
        assertThat(fieldNames(body.get("broadcast"))).as("K1 broadcast keys").isEqualTo(set("type", "price", "salePrice"));
        JsonNode items = body.get("items");
        List<String> types = new ArrayList<>();
        List<Integer> prices = new ArrayList<>();
        for (JsonNode item : items) {
            assertThat(fieldNames(item)).as("K1 item keys of %s", item.path("type").asText())
                    .isEqualTo(set("type", "price", "salePrice", "owned"));
            types.add(item.path("type").asText());
            prices.add(item.path("price").asInt());
        }
        assertThat(types).as("K1 types in order").containsExactlyElementsOf(SHOP_TYPES);
        assertThat(prices).as("K1 regular prices in order").containsExactlyElementsOf(SHOP_PRICES);
    }

    @Test
    void k2_todaysBroadcastIsTheSeoulEpochDayModTwentySix() throws Exception {
        TestUser user = newUser("k2");

        LocalDate before = LocalDate.now(SEOUL);
        JsonNode body = JSON.readTree(send(user, "GET", "/api/home-shopping", null).body());
        LocalDate after = LocalDate.now(SEOUL);

        // 자정을 넘긴 드문 경우에는 두 날 중 하나다
        List<String> expected = new ArrayList<>();
        expected.add(SHOP_TYPES.get((int) Math.floorMod(before.toEpochDay(), 26L)));
        expected.add(SHOP_TYPES.get((int) Math.floorMod(after.toEpochDay(), 26L)));
        String type = body.path("broadcast").path("type").asText();
        assertThat(type).as("K2 broadcast type (Seoul %s..%s)", before, after).isIn(expected.toArray());
        int price = SHOP_PRICES.get(SHOP_TYPES.indexOf(type));
        assertThat(body.path("broadcast").path("price").asInt()).as("K2 broadcast price").isEqualTo(price);
        assertThat(body.path("broadcast").path("salePrice").asInt()).as("K2 broadcast salePrice").isEqualTo(price * 8 / 10);
        for (JsonNode item : body.get("items")) {
            String itemType = item.path("type").asText();
            if (itemType.equals(type)) {
                assertThat(item.path("salePrice").asInt()).as("K2 salePrice of %s", itemType).isEqualTo(price * 8 / 10);
            } else {
                assertThat(item.has("salePrice") && item.get("salePrice").isNull()).as("K2 salePrice of %s is null", itemType).isTrue();
            }
        }
    }

    @Test
    void k3_newUserOwnsOnlyTheStarterFurniture() throws Exception {
        TestUser user = newUser("k3");

        JsonNode body = JSON.readTree(send(user, "GET", "/api/home-shopping", null).body());

        for (JsonNode item : body.get("items")) {
            String type = item.path("type").asText();
            assertThat(item.path("owned").asInt()).as("K3 owned of %s", type).isEqualTo(STARTER.getOrDefault(type, 0));
        }
    }

    @Test
    void k4_notSoldTypesCannotBeOrdered() throws Exception {
        TestUser user = newUser("k4");
        send(user, "GET", "/api/loop-points", null);
        jdbc.update("UPDATE loop_point_balances SET balance = 10000 WHERE user_id = ?", user.id());

        for (String type : List.of("desk", "bookcase", "board", "window", "goggles", "sofa")) {
            ObjectNode order = JSON.createObjectNode().put("type", type).put("price", 100);
            HttpResponse<String> response = send(user, "POST", "/api/home-shopping/orders", order);
            assertThat(response.statusCode()).as("K4 order %s, body %s", type, response.body()).isEqualTo(400);
            assertThat(JSON.readTree(response.body()).path("code").asText()).as("K4 code of %s", type).isEqualTo("UNKNOWN_PRODUCT");
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM home_shopping_orders WHERE user_id = ?", Integer.class, user.id()))
                .as("K4 no order rows").isZero();
    }

    // =====================================================================
    // 옷장
    // =====================================================================

    @Test
    void k5_wardrobeListsEachClothWithItsSlot() throws Exception {
        TestUser user = newUser("k5");
        ownAllClothes(user);

        HttpResponse<String> response = send(user, "GET", "/api/wardrobe", null);

        assertThat(response.statusCode()).as("K5 GET /api/wardrobe, body %s", response.body()).isEqualTo(200);
        List<String> typeSlots = new ArrayList<>();
        for (JsonNode item : JSON.readTree(response.body()).get("items")) {
            typeSlots.add(item.path("type").asText() + "/" + item.path("slot").asText());
        }
        List<String> expected = new ArrayList<>();
        expected.add("goggles/face");
        SOLD_CLOTHES.forEach(cloth -> expected.add(cloth[0] + "/" + cloth[1]));
        assertThat(typeSlots).as("K5 wardrobe items").containsExactlyElementsOf(expected);
    }

    @Test
    void k6_eachClothCanBeWornOnlyInItsSlot() throws Exception {
        TestUser user = newUser("k6");
        ownAllClothes(user);
        List<String[]> all = new ArrayList<>();
        all.add(new String[] {"goggles", "face"});
        all.addAll(SOLD_CLOTHES);

        for (String[] cloth : all) {
            for (String slot : WEAR_SLOTS) {
                ObjectNode equipped = JSON.createObjectNode().put(slot, cloth[0]);
                HttpResponse<String> response = send(user, "PUT", "/api/wardrobe/equipped", equipped);
                String label = "K6 " + cloth[0] + " in " + slot;
                if (slot.equals(cloth[1])) {
                    assertThat(response.statusCode()).as("%s, body %s", label, response.body()).isEqualTo(200);
                    assertThat(JSON.readTree(response.body()).path("equipped").path(slot).asText()).as("%s equipped", label).isEqualTo(cloth[0]);
                } else {
                    assertThat(response.statusCode()).as("%s, body %s", label, response.body()).isEqualTo(400);
                    assertThat(JSON.readTree(response.body()).path("code").asText()).as("%s code", label).isEqualTo("WARDROBE_INVALID");
                }
            }
        }
    }

    @Test
    void k7_unknownOrFurnitureTypesCannotBeWorn() throws Exception {
        TestUser user = newUser("k7");
        ownAllClothes(user);

        for (String type : List.of("bed", "lamp", "desk", "sofa")) {
            for (String slot : WEAR_SLOTS) {
                ObjectNode equipped = JSON.createObjectNode().put(slot, type);
                HttpResponse<String> response = send(user, "PUT", "/api/wardrobe/equipped", equipped);
                assertThat(response.statusCode()).as("K7 %s in %s, body %s", type, slot, response.body()).isEqualTo(400);
                assertThat(JSON.readTree(response.body()).path("code").asText()).as("K7 code %s in %s", type, slot).isEqualTo("WARDROBE_INVALID");
            }
        }
    }

    // =====================================================================
    // 배치
    // =====================================================================

    @Test
    void k8_layoutWithAllFourteenKindsInTheirMountsIsSaved() throws Exception {
        TestUser user = newUser("k8");
        ownForFullLayout(user);

        HttpResponse<String> response = send(user, "PUT", "/api/lobby-layout", fullLayout());

        assertThat(response.statusCode()).as("K8 PUT full layout, body %s", response.body()).isEqualTo(200);
        HttpResponse<String> load = send(user, "GET", "/api/lobby-layout", null);
        assertThat(load.statusCode()).as("K8 GET").isEqualTo(200);
        assertThat(JSON.readTree(load.body())).as("K8 loaded layout").isEqualTo(fullLayout());
    }

    @Test
    void k9_eachKindInAnotherMountIsRejected() throws Exception {
        TestUser user = newUser("k9");
        ownForFullLayout(user);
        // 종류마다 두는 곳: 바닥(floor), 벽(wall), 받침 위(on)
        Map<String, String> mounts = new LinkedHashMap<>();
        for (String type : List.of("desk", "bookcase", "wardrobe", "rug", "bed", "nightstand", "floorLamp", "plant")) {
            mounts.put(type, "floor");
        }
        for (String type : List.of("board", "window", "frame")) {
            mounts.put(type, "wall");
        }
        for (String type : List.of("lamp", "smallPlant", "books")) {
            mounts.put(type, "on");
        }
        for (Map.Entry<String, String> kind : mounts.entrySet()) {
            String id = idOfType(kind.getKey());
            for (String mount : List.of("floor", "wall", "on")) {
                if (mount.equals(kind.getValue())) {
                    continue;
                }
                ObjectNode layout = fullLayout();
                ObjectNode item = itemById(layout, id);
                item.remove(List.of("floor", "wall", "on"));
                item.set(mount, spot(mount));
                assertRejected(user, layout, "INVALID_LOBBY_LAYOUT", "K9 " + kind.getKey() + " as " + mount);
            }
        }
        assertSavedUnchanged(user, "K9");
    }

    @Test
    void k10_placeKindsExactlyOnceAndNeverStored() throws Exception {
        TestUser user = newUser("k10");
        ownForFullLayout(user);
        for (String place : PLACE_KINDS) {
            // 빠짐
            ObjectNode missing = fullLayout();
            removeById(missing, place);
            if (place.equals("desk")) {
                // 책상 위 소품도 함께 뺀다(받침이 없어 거절되는 것과 섞이지 않게)
                removeById(missing, "lamp");
                removeById(missing, "books");
            }
            assertRejected(user, missing, "INVALID_LOBBY_LAYOUT", "K10 without " + place);
            // 둘
            ObjectNode twice = fullLayout();
            ObjectNode copy = itemById(twice, place).deepCopy();
            copy.put("id", place + "-2");
            ((ArrayNode) twice.get("items")).add(copy);
            assertRejected(user, twice, "INVALID_LOBBY_LAYOUT", "K10 two " + place);
            // 보관함에
            ObjectNode stored = fullLayout();
            stored.set("stored", JSON.createArrayNode().add(storedItem(place + "-9", place)));
            assertRejected(user, stored, "INVALID_LOBBY_LAYOUT", "K10 stored " + place);
        }
        assertSavedUnchanged(user, "K10");
    }

    @Test
    void k11_everyStorableKindCanBeStored() throws Exception {
        TestUser user = newUser("k11");
        ownForFullLayout(user);
        // 보관함에 한 개씩 더 넣을 만큼 더 산다
        for (String type : STORABLE_KINDS) {
            buy(user, type);
        }
        ObjectNode layout = fullLayout();
        ArrayNode stored = JSON.createArrayNode();
        for (String type : STORABLE_KINDS) {
            stored.add(storedItem(type + "-9", type));
        }
        layout.set("stored", stored);

        HttpResponse<String> response = send(user, "PUT", "/api/lobby-layout", layout);

        assertThat(response.statusCode()).as("K11 PUT with ten stored kinds, body %s", response.body()).isEqualTo(200);
        assertThat(JSON.readTree(send(user, "GET", "/api/lobby-layout", null).body())).as("K11 loaded").isEqualTo(layout);
    }

    @Test
    void k12_tabletopSlotsOfEachKind() throws Exception {
        TestUser user = newUser("k12");
        ownForFullLayout(user);
        buy(user, "smallPlant");
        // 책상 자리 0·1·2, 협탁 자리 0은 된다
        ObjectNode ok = fullLayout();
        ((ArrayNode) ok.get("items")).add(onItem("smallPlant-2", "smallPlant", "desk", 1));
        HttpResponse<String> okResponse = send(user, "PUT", "/api/lobby-layout", ok);
        assertThat(okResponse.statusCode()).as("K12 desk slots 0,1,2 and nightstand slot 0, body %s", okResponse.body()).isEqualTo(200);

        // 책상 자리 3, 협탁 자리 1, 윗면 없는 바닥 가구, 벽 가구, 소품 위는 안 된다
        List<String[]> rejected = List.of(
                new String[] {"desk", "3"},
                new String[] {"nightstand", "1"},
                new String[] {"bookcase", "0"},
                new String[] {"wardrobe", "0"},
                new String[] {"rug", "0"},
                new String[] {"bed", "0"},
                new String[] {"floorLamp", "0"},
                new String[] {"plant", "0"},
                new String[] {"board", "0"},
                new String[] {"window", "0"},
                new String[] {"frame", "0"},
                new String[] {"lamp", "0"});
        for (String[] target : rejected) {
            ObjectNode layout = fullLayout();
            ObjectNode on = (ObjectNode) itemById(layout, "smallPlant").get("on");
            on.put("parent", target[0]);
            on.put("slot", Integer.parseInt(target[1]));
            assertRejected(user, layout, "INVALID_LOBBY_LAYOUT", "K12 smallPlant on " + target[0] + " slot " + target[1]);
        }
        assertThat(JSON.readTree(send(user, "GET", "/api/lobby-layout", null).body())).as("K12 saved layout unchanged").isEqualTo(ok);
    }

    @Test
    void k13_unknownKindsAreRejectedInTheRoomAndInStorage() throws Exception {
        TestUser user = newUser("k13");
        ownForFullLayout(user);
        for (String type : List.of("goggles", "capOrange", "sofa")) {
            ObjectNode inRoom = fullLayout();
            ((ArrayNode) inRoom.get("items")).add(floorItem(type + "-1", type, 4, 4, 0));
            assertRejected(user, inRoom, "INVALID_LOBBY_LAYOUT", "K13 " + type + " in the room");
            ObjectNode inStorage = fullLayout();
            inStorage.set("stored", JSON.createArrayNode().add(storedItem(type + "-1", type)));
            assertRejected(user, inStorage, "INVALID_LOBBY_LAYOUT", "K13 " + type + " in storage");
        }
        assertSavedUnchanged(user, "K13");
    }

    @Test
    void k14_ownershipLimitsStorableKindsButNotPlaceKinds() throws Exception {
        TestUser user = newUser("k14");
        // 새 계정: 처음 가진 옷장·러그·스탠드 하나씩만으로 처음 배치는 된다(장소 가구는 세지 않는다)
        HttpResponse<String> starter = send(user, "PUT", "/api/lobby-layout", starterLayout());
        assertThat(starter.statusCode()).as("K14 starter layout, body %s", starter.body()).isEqualTo(200);

        for (String type : List.of("wardrobe", "rug", "lamp")) {
            ObjectNode layout = starterLayout();
            layout.set("stored", JSON.createArrayNode().add(storedItem(type + "-9", type)));
            assertRejected(user, layout, "INVALID_LOBBY_LAYOUT", "K14 a second " + type);
        }
        for (String type : List.of("bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame")) {
            ObjectNode layout = starterLayout();
            layout.set("stored", JSON.createArrayNode().add(storedItem(type + "-1", type)));
            assertRejected(user, layout, "INVALID_LOBBY_LAYOUT", "K14 unbought " + type);
        }
        assertThat(JSON.readTree(send(user, "GET", "/api/lobby-layout", null).body())).as("K14 saved").isEqualTo(starterLayout());
    }

    // =====================================================================
    // 배치 도우미
    // =====================================================================

    /** 처음 배치(앱·서버 DEFAULT_LAYOUT과 같은 자리). */
    private static ObjectNode starterLayout() {
        ArrayNode items = JSON.createArrayNode();
        items.add(floorItem("desk", "desk", 1.5, 5.5, 0));
        items.add(floorItem("bookcase", "bookcase", 0.5, 2.5, 1));
        items.add(floorItem("wardrobe", "wardrobe", 7.5, 3.5, 3));
        items.add(floorItem("rug", "rug", 4.6, 7.2, 0));
        items.add(wallItem("board", "board", "back", 1.8));
        items.add(wallItem("window", "window", "back", 4.8));
        items.add(onItem("lamp", "lamp", "desk", 0));
        ObjectNode layout = JSON.createObjectNode();
        layout.put("version", 2);
        layout.set("items", items);
        return layout;
    }

    /** 가구 열넷을 하나씩 모두 그 두는 곳에 둔 배치(겹침은 서버가 보지 않는다). */
    private static ObjectNode fullLayout() {
        ObjectNode layout = starterLayout();
        ArrayNode items = (ArrayNode) layout.get("items");
        items.add(floorItem("bed", "bed", 6.0, 8.0, 0));
        items.add(floorItem("nightstand", "nightstand", 4.0, 3.0, 0));
        items.add(floorItem("floorLamp", "floorLamp", 3.0, 9.0, 0));
        items.add(floorItem("plant", "plant", 7.0, 10.0, 0));
        items.add(wallItem("frame", "frame", "left", 5.0));
        items.add(onItem("books", "books", "desk", 2));
        items.add(onItem("smallPlant", "smallPlant", "nightstand", 0));
        return layout;
    }

    private static String idOfType(String type) {
        return type;
    }

    private static ObjectNode floorItem(String id, String type, double x, double z, int facing) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("floor", JSON.createObjectNode().put("x", x).put("z", z).put("facing", facing));
        return item;
    }

    private static ObjectNode wallItem(String id, String type, String wall, double along) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("wall", JSON.createObjectNode().put("wall", wall).put("along", along));
        return item;
    }

    private static ObjectNode onItem(String id, String type, String parent, int slot) {
        ObjectNode item = JSON.createObjectNode().put("id", id).put("type", type);
        item.set("on", JSON.createObjectNode().put("parent", parent).put("slot", slot).put("facing", 0));
        return item;
    }

    private static ObjectNode storedItem(String id, String type) {
        return JSON.createObjectNode().put("id", id).put("type", type);
    }

    /** 두는 곳마다 맞는 자리 값(바닥: 방 안, 벽: 걸 수 있는 벽, 받침: 비어 있는 책상 자리 1). */
    private static ObjectNode spot(String mount) {
        return switch (mount) {
            case "floor" -> JSON.createObjectNode().put("x", 4.0).put("z", 5.0).put("facing", 0);
            case "wall" -> JSON.createObjectNode().put("wall", "right").put("along", 5.0);
            default -> JSON.createObjectNode().put("parent", "desk").put("slot", 1).put("facing", 0);
        };
    }

    private static ObjectNode itemById(ObjectNode layout, String id) {
        for (JsonNode item : layout.get("items")) {
            if (id.equals(item.path("id").asText())) {
                return (ObjectNode) item;
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }

    private static void removeById(ObjectNode layout, String id) {
        ArrayNode items = (ArrayNode) layout.get("items");
        for (int i = 0; i < items.size(); i++) {
            if (id.equals(items.get(i).path("id").asText())) {
                items.remove(i);
                return;
            }
        }
        throw new IllegalArgumentException("no item " + id);
    }

    /** 가득 찬 배치에 필요한 가구를 산 기록으로 넣는다(처음 가진 옷장·러그·스탠드는 빼고). */
    private void ownForFullLayout(TestUser user) {
        for (String type : List.of("bed", "nightstand", "floorLamp", "plant", "frame", "books", "smallPlant")) {
            buy(user, type);
        }
    }

    private void buy(TestUser user, String type) {
        jdbc.update(
                "INSERT INTO home_shopping_orders (user_id, furniture_type, price, item_id, created_at) VALUES (?, ?, 0, ?, NOW(6))",
                user.id(), type, "qa-090k-" + type);
    }

    /** 저장이 400과 그 코드로 거절된다. */
    private void assertRejected(TestUser user, ObjectNode layout, String code, String label) throws Exception {
        HttpResponse<String> response = send(user, "PUT", "/api/lobby-layout", layout);
        assertThat(response.statusCode()).as("%s, body %s", label, response.body()).isEqualTo(400);
        assertThat(JSON.readTree(response.body()).path("code").asText()).as("%s code", label).isEqualTo(code);
    }

    /** 거절만 있었으면 저장된 배치가 없다(404). */
    private void assertSavedUnchanged(TestUser user, String label) throws Exception {
        assertThat(send(user, "GET", "/api/lobby-layout", null).statusCode()).as("%s nothing saved", label).isEqualTo(404);
    }

    // =====================================================================
    // 옷 도우미
    // =====================================================================

    /** 산 옷 열여섯을 SOLD_CLOTHES 순서로 가진 것으로 넣는다(얻은 때가 1분씩 늦다). */
    private void ownAllClothes(TestUser user) {
        for (int i = 0; i < SOLD_CLOTHES.size(); i++) {
            jdbc.update(
                    "INSERT INTO wardrobe_items (user_id, item_type, acquired_at) VALUES (?, ?, ?)",
                    user.id(), SOLD_CLOTHES.get(i)[0], String.format("2026-11-01 00:%02d:00", i));
        }
    }

    // =====================================================================
    // 사용자·요청
    // =====================================================================

    private record TestUser(long id, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-090k-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-090k-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);
        HttpResponse<String> login = client.send(
                HttpRequest.newBuilder(uri("/api/auth/token/login"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).as("setup: token login, body %s", login.body()).isEqualTo(200);
        String token = JSON.readTree(login.body()).path("accessToken").asText();
        assertThat(token).as("setup: access token").isNotBlank();
        return new TestUser(userId, token);
    }

    private HttpResponse<String> send(TestUser user, String method, String path, JsonNode body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(uri(path)).header("Authorization", "Bearer " + user.token());
        if (body == null) {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new LinkedHashSet<>();
        if (node != null) {
            node.fieldNames().forEachRemaining(names::add);
        }
        return names;
    }

    private static Set<String> set(String... names) {
        return new LinkedHashSet<>(List.of(names));
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
