package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.service.ItemCatalogHumanWearablesSpecTest;
import com.writeloop.service.ItemCatalogHumanWearablesSpecTest.Human;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * [spec] 작업 134 ② 사람형 착용물 연결, GET /api/catalog 응답(실제 서버).
 * 옷의 draw에 body 2와 hide(숨길 기본 메시)가 나가고, 모델 파일 해시가 사람형 파일이며, 새 옷 다섯은 아이콘이 없다.
 * 옛 앱을 위해 응답 필드는 늘기만 한다(draw.hide 추가, 다른 필드는 그대로).
 */
class CatalogHumanWearablesApiSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @Test
    void a1_drawOfEveryHumanClothIsServedWithBodyTwoAndHide() throws Exception {
        Map<String, JsonNode> served = served();
        for (Human h : ItemCatalogHumanWearablesSpecTest.HUMANS) {
            JsonNode item = served.get(h.id());
            assertThat(item).as("A1 %s in /api/catalog", h.id()).isNotNull();
            assertThat(item.path("slot").asText()).as("A1 %s slot", h.id()).isEqualTo(h.slot());
            JsonNode draw = item.path("draw");
            assertThat(draw.path("attach").asText()).as("A1 %s attach", h.id()).isEqualTo(h.attach());
            assertThat(text(draw, "bone")).as("A1 %s bone", h.id()).isEqualTo(h.bone());
            assertThat(text(draw, "mirror")).as("A1 %s mirror", h.id()).isEqualTo(h.mirror());
            assertThat(text(draw, "color")).as("A1 %s color", h.id()).isEqualTo(h.color());
            assertThat(draw.path("body").asInt()).as("A1 %s body", h.id()).isEqualTo(2);
            assertThat(ItemCatalogHumanWearablesSpecTest.hide(draw)).as("A1 %s hide", h.id()).isEqualTo(h.hide());
        }
    }

    @Test
    void a2_servedModelIsTheHumanFile() throws Exception {
        Map<String, JsonNode> served = served();
        for (Human h : ItemCatalogHumanWearablesSpecTest.HUMANS) {
            JsonNode model = served.get(h.id()).path("assets").path("model");
            assertThat(model.path("sha256").asText()).as("A2 %s model sha256", h.id()).isEqualTo(h.sha256());
            assertThat(model.path("bytes").asLong()).as("A2 %s model bytes", h.id()).isEqualTo(h.bytes());
            HttpResponse<byte[]> response = client.send(HttpRequest.newBuilder(URI.create(rest.getRootUri() + model.path("url").asText())).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertThat(response.statusCode()).as("A2 %s GET model url", h.id()).isEqualTo(200);
            assertThat(ItemCatalogHumanWearablesSpecTest.sha256(response.body())).as("A2 %s downloaded sha256", h.id()).isEqualTo(h.sha256());
        }
    }

    @Test
    void a3_fiveNewClothesAreServedWithoutIconAndNotForSale() throws Exception {
        Map<String, JsonNode> served = served();
        for (String id : ItemCatalogHumanWearablesSpecTest.NEW_NAMES.keySet()) {
            JsonNode item = served.get(id);
            assertThat(item).as("A3 %s in /api/catalog", id).isNotNull();
            assertThat(item.path("name").asText()).as("A3 %s name", id).isEqualTo(ItemCatalogHumanWearablesSpecTest.NEW_NAMES.get(id));
            assertThat(item.hasNonNull("price")).as("A3 %s has no price: %s", id, item).isFalse();
            assertThat(item.path("assets").hasNonNull("icon")).as("A3 %s has no icon asset: %s", id, item).isFalse();
        }
    }

    @Test
    void a4_oldIconsAndVestAndGogglesStayTheSame() throws Exception {
        Map<String, JsonNode> served = served();
        for (Map.Entry<String, String> entry : ItemCatalogHumanWearablesSpecTest.ICON_SHA.entrySet()) {
            assertThat(served.get(entry.getKey()).path("assets").path("icon").path("sha256").asText())
                    .as("A4 icon sha256 of %s", entry.getKey()).isEqualTo(entry.getValue());
        }
        JsonNode vest = served.get("vestGreen");
        assertThat(vest.path("draw").path("body").asInt()).as("A4 vest body stays 1").isEqualTo(1);
        assertThat(vest.path("draw").has("hide")).as("A4 vest has no hide").isFalse();
        assertThat(vest.path("assets").path("model").path("sha256").asText()).as("A4 vest model").isEqualTo(ItemCatalogHumanWearablesSpecTest.VEST_MODEL_SHA);
        JsonNode goggles = served.get("goggles");
        assertThat(goggles.has("draw") && goggles.get("draw").isNull()).as("A4 goggles draw is null: %s", goggles).isTrue();
        assertThat(goggles.has("assets") && goggles.get("assets").isNull()).as("A4 goggles assets is null: %s", goggles).isTrue();
    }

    @Test
    void a5_servedWearableCountIsThirtySix() throws Exception {
        int count = 0;
        for (JsonNode item : catalog().path("items")) {
            if ("wearable".equals(item.path("kind").asText())) {
                count++;
            }
        }
        assertThat(count).as("A5 31 old wearables + 5 new").isEqualTo(36);
    }

    private Map<String, JsonNode> served() throws Exception {
        Map<String, JsonNode> map = new LinkedHashMap<>();
        for (JsonNode item : catalog().path("items")) {
            map.put(item.path("id").asText(), item);
        }
        return map;
    }

    private JsonNode catalog() throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(URI.create(rest.getRootUri() + "/api/catalog")).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("GET /api/catalog, body %s", response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private static String text(JsonNode node, String key) {
        JsonNode value = node.get(key);
        return value == null || value.isNull() ? null : value.asText();
    }
}
