package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.service.ItemCatalogHumanWearablesSpecTest;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 134 ② 사람형 착용물 연결, 서버 옷장 기본 착장.
 * 명세 "서버 옷장 기본 착장": 착장을 저장한 적 없는 사용자에게 돌려주는 기본 착용의 얼굴장식을 고글에서 없음으로 바꾼다.
 * 고글은 가진 옷 목록에 그대로 있다. 저장된 착장이 있는 사용자는 바뀌지 않는다.
 * 새 사람형 옷 다섯은 판매 안 함이라 홈쇼핑 목록에 없고 옷장 목록에도 없다.
 * 테스트마다 새 사용자를 만든다(자기 데이터만 확인).
 */
class WardrobeHumanDefaultSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final List<String> SLOTS = List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory");

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // ---- 바뀔 동작 ----

    @Test
    void d1_neverSavedAccountHasNoFaceItemByDefault() throws Exception {
        String token = newUser("d1");

        JsonNode body = JSON.readTree(get(token, "/api/wardrobe").body());

        JsonNode equipped = body.path("equipped");
        for (String slot : SLOTS) {
            assertThat(equipped.has(slot)).as("D1 equipped has %s", slot).isTrue();
            assertThat(equipped.get(slot).isNull()).as("D1 equipped.%s is null: %s", slot, equipped).isTrue();
        }
    }

    @Test
    void d2_gogglesAreStillOwnedFirstInTheWardrobeList() throws Exception {
        String token = newUser("d2");

        JsonNode items = JSON.readTree(get(token, "/api/wardrobe").body()).path("items");

        assertThat(items.size()).as("D2 only goggles for a new account").isEqualTo(1);
        assertThat(items.get(0).path("type").asText()).as("D2 type").isEqualTo("goggles");
        assertThat(items.get(0).path("slot").asText()).as("D2 slot").isEqualTo("face");
    }

    @Test
    void d3_gogglesCanBeWornAfterwardsAndStaySaved() throws Exception {
        String token = newUser("d3");

        HttpResponse<String> put = put(token, "{\"face\": \"goggles\"}");

        assertThat(put.statusCode()).as("D3 PUT goggles, body %s", put.body()).isEqualTo(200);
        assertThat(JSON.readTree(put.body()).path("equipped").path("face").asText()).as("D3 face after PUT").isEqualTo("goggles");
        assertThat(JSON.readTree(get(token, "/api/wardrobe").body()).path("equipped").path("face").asText()).as("D3 face after GET").isEqualTo("goggles");
    }

    @Test
    void d4_fiveNewClothesAreNotInTheWardrobeNorTheHomeShopping() throws Exception {
        String token = newUser("d4");
        String wardrobe = get(token, "/api/wardrobe").body();
        String shop = get(token, "/api/home-shopping").body();

        for (String id : ItemCatalogHumanWearablesSpecTest.NEW_NAMES.keySet()) {
            assertThat(wardrobe).as("D4 wardrobe has no %s", id).doesNotContain(id);
            assertThat(shop).as("D4 home-shopping has no %s", id).doesNotContain(id);
        }
    }

    // ---- 그대로 둘 동작: 저장된 착장은 바뀌지 않는다 ----

    @Test
    void k1_savedGogglesOutfitStaysGoggles() throws Exception {
        String token = newUser("k1");
        assertThat(put(token, "{\"face\": \"goggles\"}").statusCode()).as("K1 setup").isEqualTo(200);

        assertThat(JSON.readTree(get(token, "/api/wardrobe").body()).path("equipped").path("face").asText()).as("K1 face").isEqualTo("goggles");
    }

    @Test
    void k2_savedEmptyOutfitStaysEmpty() throws Exception {
        String token = newUser("k2");
        assertThat(put(token, "{}").statusCode()).as("K2 setup").isEqualTo(200);

        JsonNode equipped = JSON.readTree(get(token, "/api/wardrobe").body()).path("equipped");
        List<String> nulls = new ArrayList<>();
        for (String slot : SLOTS) {
            if (equipped.path(slot).isNull()) {
                nulls.add(slot);
            }
        }
        assertThat(nulls).as("K2 all slots null: %s", equipped).containsExactlyElementsOf(SLOTS);
    }

    @Test
    void k3_savedOtherSlotOnlyHasNoFace() throws Exception {
        String token = newUser("k3");
        jdbc.update("INSERT INTO wardrobe_items (user_id, item_type, acquired_at) SELECT id, 'capOrange', NOW(6) FROM users WHERE email = ?", emailOf(token));
        assertThat(put(token, "{\"hat\": \"capOrange\"}").statusCode()).as("K3 setup").isEqualTo(200);

        JsonNode equipped = JSON.readTree(get(token, "/api/wardrobe").body()).path("equipped");

        assertThat(equipped.path("hat").asText()).as("K3 hat").isEqualTo("capOrange");
        assertThat(equipped.path("face").isNull()).as("K3 face is null: %s", equipped).isTrue();
    }

    // ---- 도움 ----

    private final Map<String, String> emails = new LinkedHashMap<>();

    private String emailOf(String token) {
        return emails.get(token);
    }

    private String newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-134b-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-134b-" + tag + "-" + suffix);
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
        emails.put(token, email);
        return token;
    }

    private HttpResponse<String> get(String token, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).header("Authorization", "Bearer " + token).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, String rawBody) throws Exception {
        return client.send(HttpRequest.newBuilder(uri("/api/wardrobe/equipped"))
                        .header("Authorization", "Bearer " + token)
                        .header("Content-Type", "application/json")
                        .PUT(HttpRequest.BodyPublishers.ofString(rawBody)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
