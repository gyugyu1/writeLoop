package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.persistence.WardrobeItemEntity;
import com.writeloop.persistence.WardrobeItemRepository;
import com.writeloop.service.AccountDataPurgeService;
import com.writeloop.support.IntegrationTestSupport;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 089 ② 착용 아이템 목록과 서버 저장, 백엔드 영역. 시나리오 02-qa-scenarios.md(F, S, P, X, A, K, D1·D2, W)와
 * 결정 04-main-decision.md(M1: 모르는 부위 키는 무시, M2: 문자열이 아닌 값은 WARDROBE_INVALID, 빈 본문·null은 모두 벗음,
 * 읽을 수 없는 본문은 일반 400, G3: 유일 키, G4: AccountDataPurgeService가 직접 지움)를 실제 서버로 확인한다.
 *
 * <ul>
 *   <li>로그인은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만든다.</li>
 *   <li>own(U, 종류, 시각)은 앱과 같은 저장 방식이 되게 WardrobeItemRepository로 넣는다(명세: 테스트는 DB에 직접 넣는다).</li>
 *   <li>200 응답은 기대 JSON 전체와 같아야 한다(F1의 키 모양과 F2의 acquiredAt 문자열을 함께 본다).</li>
 * </ul>
 */
class WardrobeControllerSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final String T1 = "2026-11-13T12:00:00Z";
    private static final String T2 = "2026-11-13T12:05:00Z";
    private static final String T3 = "2026-11-13T12:10:00Z";
    private static final String T4 = "2026-11-13T12:15:00Z";

    private static final List<String> SLOTS = List.of("hat", "top", "bottom", "shoes", "face", "back", "accessory");

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private WardrobeItemRepository wardrobeItemRepository;

    @Autowired
    private AccountDataPurgeService accountDataPurgeService;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    // =====================================================================
    // F, S. 응답 모양과 조회
    // =====================================================================

    @Test
    void s1_newUserHasNoItemsAndNothingEquipped() throws Exception {
        TestUser u = newUser("s1");

        HttpResponse<String> response = get(u.token());

        assertOkBody(response, wardrobe(items(), equipped()), "S1");
    }

    @Test
    void s2_f2_ownedButNotEquipped() throws Exception {
        TestUser u = newUser("s2");
        own(u, "capOrange", T1);

        HttpResponse<String> response = get(u.token());

        assertOkBody(response, wardrobe(items(item("capOrange", "hat", T1)), equipped()), "S2");
        // F2: acquiredAt 문자열 그대로
        assertThat(JSON.readTree(response.body()).path("items").get(0).path("acquiredAt").asText())
                .as("F2 acquiredAt").isEqualTo("2026-11-13T12:00:00Z");
    }

    @Test
    void s3_itemsAreInAcquiredOrderWithTheirSlots() throws Exception {
        TestUser u = newUser("s3");
        // 넣는 순서(id 순서)를 얻은 때 순서와 다르게
        own(u, "capOrange", T2);
        own(u, "tshirtOrange", T4);
        own(u, "shortsNavy", T3);
        own(u, "shoesBrown", T1);

        HttpResponse<String> response = get(u.token());

        assertOkBody(response, wardrobe(items(
                item("shoesBrown", "shoes", T1),
                item("capOrange", "hat", T2),
                item("shortsNavy", "bottom", T3),
                item("tshirtOrange", "top", T4)), equipped()), "S3");
    }

    @Test
    void s4_equippedItemStaysInItems() throws Exception {
        TestUser u = newUser("s4");
        own(u, "capOrange", T1);
        assertThat(put(u.token(), "{\"hat\": \"capOrange\"}").statusCode()).as("S4 setup PUT").isEqualTo(200);

        HttpResponse<String> response = get(u.token());

        assertOkBody(response, wardrobe(items(item("capOrange", "hat", T1)), equipped("hat", "capOrange")), "S4");
    }

    // =====================================================================
    // P. 입은 것 바꾸기(성공)
    // =====================================================================

    private static final String P1_BODY = "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\", \"bottom\": \"shortsNavy\","
            + " \"shoes\": \"shoesBrown\", \"face\": null, \"back\": null, \"accessory\": null}";

    private TestUser ownFour(String tag) throws Exception {
        TestUser u = newUser(tag);
        own(u, "capOrange", T1);
        own(u, "tshirtOrange", T2);
        own(u, "shortsNavy", T3);
        own(u, "shoesBrown", T4);
        return u;
    }

    private static ArrayNode i4() {
        return items(
                item("capOrange", "hat", T1),
                item("tshirtOrange", "top", T2),
                item("shortsNavy", "bottom", T3),
                item("shoesBrown", "shoes", T4));
    }

    private static ObjectNode p1Equipped() {
        return equipped("hat", "capOrange", "top", "tshirtOrange", "bottom", "shortsNavy", "shoes", "shoesBrown");
    }

    @Test
    void p1_putEquipsAllAtOnceAndMatchesGet() throws Exception {
        TestUser u = ownFour("p1");

        HttpResponse<String> response = put(u.token(), P1_BODY);

        assertOkBody(response, wardrobe(i4(), p1Equipped()), "P1 PUT");
        assertThat(JSON.readTree(get(u.token()).body())).as("P1 GET equals PUT").isEqualTo(JSON.readTree(response.body()));
    }

    @Test
    void p2_missingSlotsAreNull() throws Exception {
        TestUser u = ownFour("p2");
        assertThat(put(u.token(), P1_BODY).statusCode()).as("P2 setup").isEqualTo(200);

        HttpResponse<String> response = put(u.token(), "{\"top\": \"tshirtOrange\"}");

        assertOkBody(response, wardrobe(i4(), equipped("top", "tshirtOrange")), "P2 PUT");
        assertThat(JSON.readTree(get(u.token()).body())).as("P2 GET equals PUT").isEqualTo(JSON.readTree(response.body()));
    }

    @Test
    void p3_emptyObjectUnequipsAll() throws Exception {
        TestUser u = ownFour("p3");
        assertThat(put(u.token(), P1_BODY).statusCode()).as("P3 setup").isEqualTo(200);

        HttpResponse<String> response = put(u.token(), "{}");

        assertOkBody(response, wardrobe(i4(), equipped()), "P3 PUT");
        assertThat(JSON.readTree(get(u.token()).body())).as("P3 GET equals PUT").isEqualTo(JSON.readTree(response.body()));
    }

    @Test
    void p4_explicitNullUnequipsOneSlot() throws Exception {
        TestUser u = ownFour("p4");
        assertThat(put(u.token(), "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\"}").statusCode()).as("P4 setup").isEqualTo(200);

        HttpResponse<String> response = put(u.token(), "{\"hat\": null, \"top\": \"tshirtOrange\", \"bottom\": null,"
                + " \"shoes\": null, \"face\": null, \"back\": null, \"accessory\": null}");

        assertOkBody(response, wardrobe(i4(), equipped("top", "tshirtOrange")), "P4 PUT");
        assertThat(JSON.readTree(get(u.token()).body())).as("P4 GET equals PUT").isEqualTo(JSON.readTree(response.body()));
    }

    @Test
    void p5_samePutTwiceGivesSameBody() throws Exception {
        TestUser u = ownFour("p5");

        HttpResponse<String> first = put(u.token(), P1_BODY);
        HttpResponse<String> second = put(u.token(), P1_BODY);

        assertOkBody(first, wardrobe(i4(), p1Equipped()), "P5 first");
        assertOkBody(second, wardrobe(i4(), p1Equipped()), "P5 second");
    }

    @Test
    void p6_newSlotsAcceptNull() throws Exception {
        TestUser u = newUser("p6");

        HttpResponse<String> response = put(u.token(), "{\"face\": null, \"back\": null, \"accessory\": null}");

        assertOkBody(response, wardrobe(items(), equipped()), "P6");
    }

    // =====================================================================
    // X. 입을 수 없는 아이템(400, 아무것도 바꾸지 않음)
    // =====================================================================

    /** X 준비: capOrange·tshirtOrange를 가지고 둘 다 입은 사용자. */
    private TestUser xUser(String tag) throws Exception {
        TestUser u = newUser(tag);
        own(u, "capOrange", T1);
        own(u, "tshirtOrange", T2);
        HttpResponse<String> setup = put(u.token(), "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\"}");
        assertThat(setup.statusCode()).as("X setup %s, body %s", tag, setup.body()).isEqualTo(200);
        return u;
    }

    private static ObjectNode xBase() {
        return wardrobe(items(item("capOrange", "hat", T1), item("tshirtOrange", "top", T2)),
                equipped("hat", "capOrange", "top", "tshirtOrange"));
    }

    private void assertInvalidAndUnchanged(String tag, String body) throws Exception {
        TestUser u = xUser(tag);

        HttpResponse<String> response = put(u.token(), body);

        assertInvalid(response, tag);
        assertOkBody(get(u.token()), xBase(), tag + " unchanged");
    }

    @Test
    void x1_notOwnedKnownType() throws Exception {
        assertInvalidAndUnchanged("x1", "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\", \"bottom\": \"shortsNavy\"}");
    }

    @Test
    void x2_onlyNotOwned() throws Exception {
        assertInvalidAndUnchanged("x2", "{\"shoes\": \"shoesBrown\"}");
    }

    @Test
    void x3_unknownType() throws Exception {
        assertInvalidAndUnchanged("x3", "{\"hat\": \"capBlue\"}");
    }

    @Test
    void x4_unknownTypeDifferentCase() throws Exception {
        assertInvalidAndUnchanged("x4", "{\"hat\": \"CapOrange\", \"top\": \"tshirtOrange\"}");
    }

    @Test
    void x5_unknownTypeFurnitureName() throws Exception {
        assertInvalidAndUnchanged("x5", "{\"hat\": \"wardrobe\"}");
    }

    @Test
    void x6_unknownTypeInNewSlot() throws Exception {
        assertInvalidAndUnchanged("x6", "{\"face\": \"sunglasses\"}");
    }

    @Test
    void x7_ownedItemInOtherSlot() throws Exception {
        assertInvalidAndUnchanged("x7", "{\"top\": \"capOrange\"}");
    }

    @Test
    void x8_swappedSlots() throws Exception {
        assertInvalidAndUnchanged("x8", "{\"hat\": \"tshirtOrange\", \"top\": \"capOrange\"}");
    }

    @Test
    void x9_ownedItemInNewSlot() throws Exception {
        assertInvalidAndUnchanged("x9", "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\", \"accessory\": \"capOrange\"}");
    }

    @Test
    void x10_mixedValidAndInvalidChangesNothing() throws Exception {
        assertInvalidAndUnchanged("x10", "{\"hat\": null, \"top\": \"tshirtOrange\", \"bottom\": \"shortsNavy\"}");
    }

    @Test
    void x11_otherUsersItemIsNotOwned() throws Exception {
        TestUser x = newUser("x11x");
        own(x, "shoesBrown", T1);
        assertThat(put(x.token(), "{\"shoes\": \"shoesBrown\"}").statusCode()).as("X11 setup X").isEqualTo(200);
        TestUser y = newUser("x11y");

        HttpResponse<String> response = put(y.token(), "{\"shoes\": \"shoesBrown\"}");

        assertInvalid(response, "X11 Y");
        assertOkBody(get(y.token()), wardrobe(items(), equipped()), "X11 Y GET");
        assertOkBody(get(x.token()), wardrobe(items(item("shoesBrown", "shoes", T1)), equipped("shoes", "shoesBrown")), "X11 X GET");
    }

    // ---- 결정 04 M1: 일곱 부위가 아닌 키는 무시하고 200 ----

    @Test
    void x12_m1_unknownSlotKeyWithItemIsIgnored() throws Exception {
        TestUser u = xUser("x12");

        HttpResponse<String> response = put(u.token(), "{\"top\": \"tshirtOrange\", \"gloves\": \"capOrange\"}");

        ObjectNode expected = wardrobe(items(item("capOrange", "hat", T1), item("tshirtOrange", "top", T2)),
                equipped("top", "tshirtOrange"));
        assertOkBody(response, expected, "X12 PUT");
        assertOkBody(get(u.token()), expected, "X12 GET");
    }

    @Test
    void x13_m1_unknownSlotKeyAloneMeansAllNull() throws Exception {
        TestUser u = xUser("x13");

        HttpResponse<String> response = put(u.token(), "{\"gloves\": null}");

        ObjectNode expected = wardrobe(items(item("capOrange", "hat", T1), item("tshirtOrange", "top", T2)), equipped());
        assertOkBody(response, expected, "X13 PUT");
        assertOkBody(get(u.token()), expected, "X13 GET");
    }

    // ---- 결정 04 M2: 문자열이 아닌 값은 모르는 종류(400 WARDROBE_INVALID) ----

    @Test
    void x14_m2_numberValueIsUnknownType() throws Exception {
        assertInvalidAndUnchanged("x14", "{\"hat\": 1, \"top\": \"tshirtOrange\"}");
    }

    @Test
    void x15_m2_booleanValueIsUnknownType() throws Exception {
        assertInvalidAndUnchanged("x15", "{\"hat\": true, \"top\": \"tshirtOrange\"}");
    }

    /**
     * 객체·배열 값도 결정 04 M2의 "문자열이 아니면"에 든다. 결정이 이 경우를 따로 예로 들지 않아, 코드는 단언하지 않고
     * 400과 아무것도 바뀌지 않음만 본다(보고에 적음).
     */
    @Test
    void x16_m2_objectOrArrayValueIs400AndChangesNothing() throws Exception {
        TestUser u = xUser("x16");

        HttpResponse<String> objectValue = put(u.token(), "{\"hat\": {}, \"top\": \"tshirtOrange\"}");
        HttpResponse<String> arrayValue = put(u.token(), "{\"hat\": [], \"top\": \"tshirtOrange\"}");

        assertThat(objectValue.statusCode()).as("X16 object value, body %s", objectValue.body()).isEqualTo(400);
        assertThat(arrayValue.statusCode()).as("X16 array value, body %s", arrayValue.body()).isEqualTo(400);
        assertOkBody(get(u.token()), xBase(), "X16 unchanged");
    }

    // ---- 결정 04 M2: 빈 본문·JSON null은 모두 벗음 ----

    @Test
    void x17_m2_emptyBodyUnequipsAll() throws Exception {
        TestUser u = xUser("x17");

        HttpResponse<String> response = put(u.token(), "");

        ObjectNode expected = wardrobe(items(item("capOrange", "hat", T1), item("tshirtOrange", "top", T2)), equipped());
        assertOkBody(response, expected, "X17 PUT");
        assertOkBody(get(u.token()), expected, "X17 GET");
    }

    @Test
    void x18_m2_jsonNullBodyUnequipsAll() throws Exception {
        TestUser u = xUser("x18");

        HttpResponse<String> response = put(u.token(), "null");

        ObjectNode expected = wardrobe(items(item("capOrange", "hat", T1), item("tshirtOrange", "top", T2)), equipped());
        assertOkBody(response, expected, "X18 PUT");
        assertOkBody(get(u.token()), expected, "X18 GET");
    }

    // ---- 결정 04 M2: 읽을 수 없는 본문은 일반 요청 오류 400, 아무것도 바꾸지 않음 ----

    @Test
    void x19_m2_arrayBodyIs400AndChangesNothing() throws Exception {
        TestUser u = xUser("x19");

        HttpResponse<String> response = put(u.token(), "[]");

        assertThat(response.statusCode()).as("X19 array body, body %s", response.body()).isEqualTo(400);
        assertOkBody(get(u.token()), xBase(), "X19 unchanged");
    }

    @Test
    void x20_m2_brokenJsonIs400AndChangesNothing() throws Exception {
        TestUser u = xUser("x20");

        HttpResponse<String> response = put(u.token(), "{\"hat\": ");

        assertThat(response.statusCode()).as("X20 broken JSON, body %s", response.body()).isEqualTo(400);
        assertOkBody(get(u.token()), xBase(), "X20 unchanged");
    }

    // =====================================================================
    // A. 로그인하지 않음
    // =====================================================================

    @Test
    void a1_getWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = get(null);

        assertThat(response.statusCode()).as("A1, body %s", response.body()).isEqualTo(401);
    }

    @Test
    void a2_putWithoutLoginIs401() throws Exception {
        HttpResponse<String> response = put(null, "{\"hat\": \"capOrange\"}");

        assertThat(response.statusCode()).as("A2, body %s", response.body()).isEqualTo(401);
    }

    @Test
    void a3_getWithBadTokenIs401() throws Exception {
        HttpResponse<String> response = get("not-a-real-token");

        assertThat(response.statusCode()).as("A3, body %s", response.body()).isEqualTo(401);
    }

    @Test
    void a4_putWithBadTokenIs401() throws Exception {
        HttpResponse<String> response = put("not-a-real-token", "{}");

        assertThat(response.statusCode()).as("A4, body %s", response.body()).isEqualTo(401);
    }

    // =====================================================================
    // K. 계정마다
    // =====================================================================

    @Test
    void k1_otherUserSeesNothing() throws Exception {
        TestUser x = newUser("k1x");
        own(x, "capOrange", T1);
        assertThat(put(x.token(), "{\"hat\": \"capOrange\"}").statusCode()).as("K1 setup").isEqualTo(200);
        TestUser y = newUser("k1y");

        assertOkBody(get(y.token()), wardrobe(items(), equipped()), "K1 Y");
    }

    @Test
    void k2_sameTypeInTwoAccountsIsIndependent() throws Exception {
        TestUser x = newUser("k2x");
        TestUser y = newUser("k2y");
        own(x, "capOrange", T1);
        own(y, "capOrange", T2);
        assertThat(put(x.token(), "{\"hat\": \"capOrange\"}").statusCode()).as("K2 X equips").isEqualTo(200);

        assertOkBody(get(y.token()), wardrobe(items(item("capOrange", "hat", T2)), equipped()), "K2 first Y GET");

        assertThat(put(y.token(), "{\"hat\": \"capOrange\"}").statusCode()).as("K2 Y equips").isEqualTo(200);
        assertThat(put(x.token(), "{}").statusCode()).as("K2 X unequips").isEqualTo(200);

        assertOkBody(get(x.token()), wardrobe(items(item("capOrange", "hat", T1)), equipped()), "K2 last X GET");
        assertOkBody(get(y.token()), wardrobe(items(item("capOrange", "hat", T2)), equipped("hat", "capOrange")), "K2 last Y GET");
    }

    // =====================================================================
    // D. DB 저장
    // =====================================================================

    @Test
    void d1_sameTypeTwiceInOneAccountIsRejectedByDb() throws Exception {
        TestUser u = newUser("d1");
        own(u, "capOrange", T1);

        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO wardrobe_items (user_id, item_type, acquired_at) VALUES (?, ?, ?)",
                u.id(), "capOrange", "2026-11-13 21:05:00"))
                .as("D1 second capOrange row")
                .isInstanceOf(DataIntegrityViolationException.class);

        assertOkBody(get(u.token()), wardrobe(items(item("capOrange", "hat", T1)), equipped()), "D1 GET");
    }

    @Test
    void d2_equippedIsStoredInDb() throws Exception {
        TestUser u = ownFour("d2");

        assertThat(put(u.token(), "{\"hat\": \"capOrange\", \"shoes\": \"shoesBrown\"}").statusCode()).as("D2 PUT").isEqualTo(200);

        Map<String, String> stored = outfitRow(u.id());
        Map<String, String> expected = new LinkedHashMap<>();
        for (String slot : SLOTS) {
            expected.put(slot, null);
        }
        expected.put("hat", "capOrange");
        expected.put("shoes", "shoesBrown");
        assertThat(stored).as("D2 stored outfit").isEqualTo(expected);

        assertThat(put(u.token(), "{}").statusCode()).as("D2 PUT {}").isEqualTo(200);

        Map<String, String> afterClear = outfitRow(u.id());
        if (afterClear != null) {
            assertThat(afterClear.values()).as("D2 stored outfit after {}: %s", afterClear).containsOnlyNulls();
        }
    }

    // =====================================================================
    // W. 회원 탈퇴
    // =====================================================================

    @Test
    void w1_accountDeletionRemovesWardrobeRows() throws Exception {
        TestUser u = newUser("w1u");
        own(u, "capOrange", T1);
        own(u, "tshirtOrange", T2);
        assertThat(put(u.token(), "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\"}").statusCode()).as("W1 U equips").isEqualTo(200);
        TestUser v = newUser("w1v");
        own(v, "capOrange", T3);
        assertThat(put(v.token(), "{\"hat\": \"capOrange\"}").statusCode()).as("W1 V equips").isEqualTo(200);

        Map<String, Object> deleteBody = new LinkedHashMap<>();
        deleteBody.put("confirmationText", "탈퇴");
        deleteBody.put("currentPassword", u.password());
        HttpResponse<String> delete = client.send(
                HttpRequest.newBuilder(uri("/api/auth/account"))
                        .header("Authorization", "Bearer " + u.token())
                        .header("Content-Type", "application/json")
                        .method("DELETE", HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(deleteBody)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(delete.statusCode()).as("W1 DELETE account, body %s", delete.body()).isEqualTo(200);
        assertThat(countItems(u.id())).as("W1 U wardrobe_items").isZero();
        assertThat(countOutfits(u.id())).as("W1 U wardrobe_outfits").isZero();
        assertOkBody(get(v.token()), wardrobe(items(item("capOrange", "hat", T3)), equipped("hat", "capOrange")), "W1 V GET");
    }

    @Test
    void w2_purgeServiceItselfRemovesWardrobeRows() throws Exception {
        TestUser u = newUser("w2u");
        own(u, "capOrange", T1);
        own(u, "tshirtOrange", T2);
        assertThat(put(u.token(), "{\"hat\": \"capOrange\", \"top\": \"tshirtOrange\"}").statusCode()).as("W2 U equips").isEqualTo(200);
        TestUser v = newUser("w2v");
        own(v, "capOrange", T3);
        assertThat(put(v.token(), "{\"hat\": \"capOrange\"}").statusCode()).as("W2 V equips").isEqualTo(200);

        // 사용자 행은 둔 채 탈퇴의 데이터 삭제 단계만
        accountDataPurgeService.purgeUserData(u.id());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, u.id()))
                .as("W2 setup: U users row stays").isEqualTo(1);
        assertThat(countItems(u.id())).as("W2 U wardrobe_items").isZero();
        assertThat(countOutfits(u.id())).as("W2 U wardrobe_outfits").isZero();
        assertThat(countItems(v.id())).as("W2 V wardrobe_items").isEqualTo(1);
        assertThat(countOutfits(v.id())).as("W2 V wardrobe_outfits").isEqualTo(1);
        assertOkBody(get(v.token()), wardrobe(items(item("capOrange", "hat", T3)), equipped("hat", "capOrange")), "W2 V GET");
    }

    // =====================================================================
    // 도움 함수
    // =====================================================================

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-089w-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-089w-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        return new TestUser(userId, email, password, login(email, password));
    }

    private String login(String email, String password) throws Exception {
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
        return token;
    }

    /** own(U, 종류, 시각): 앱과 같은 저장 방식(엔티티)으로 가진 아이템을 넣는다. */
    private void own(TestUser user, String type, String acquiredAt) {
        wardrobeItemRepository.saveAndFlush(new WardrobeItemEntity(user.id(), type, Instant.parse(acquiredAt)));
    }

    private HttpResponse<String> get(String token) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri("/api/wardrobe")).GET();
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> put(String token, String rawBody) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri("/api/wardrobe/equipped"))
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(rawBody));
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private void assertOkBody(HttpResponse<String> response, JsonNode expected, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(200);
        assertThat(JSON.readTree(response.body())).as("%s body", label).isEqualTo(expected);
    }

    private void assertInvalid(HttpResponse<String> response, String label) throws Exception {
        assertThat(response.statusCode()).as("%s status, body %s", label, response.body()).isEqualTo(400);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("code").asText()).as("%s code, body %s", label, response.body()).isEqualTo("WARDROBE_INVALID");
        assertThat(body.path("message").asText()).as("%s message, body %s", label, response.body()).isEqualTo("입을 수 없는 아이템이에요");
    }

    private static ObjectNode wardrobe(ArrayNode items, ObjectNode equipped) {
        ObjectNode node = JSON.createObjectNode();
        node.set("items", items);
        node.set("equipped", equipped);
        return node;
    }

    private static ArrayNode items(ObjectNode... items) {
        ArrayNode array = JSON.createArrayNode();
        for (ObjectNode item : items) {
            array.add(item);
        }
        return array;
    }

    private static ObjectNode item(String type, String slot, String acquiredAt) {
        ObjectNode node = JSON.createObjectNode();
        node.put("type", type);
        node.put("slot", slot);
        node.put("acquiredAt", acquiredAt);
        return node;
    }

    /** 일곱 부위가 모두 있는 equipped. 인자는 (부위, 종류) 쌍이고 나머지 부위는 null이다. */
    private static ObjectNode equipped(String... slotTypePairs) {
        ObjectNode node = JSON.createObjectNode();
        for (String slot : SLOTS) {
            node.putNull(slot);
        }
        for (int i = 0; i < slotTypePairs.length; i += 2) {
            node.put(slotTypePairs[i], slotTypePairs[i + 1]);
        }
        return node;
    }

    private int countItems(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM wardrobe_items WHERE user_id = ?", Integer.class, userId);
    }

    private int countOutfits(long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM wardrobe_outfits WHERE user_id = ?", Integer.class, userId);
    }

    /** 그 사용자의 wardrobe_outfits 행(부위 → 종류). 행이 없으면 null. */
    private Map<String, String> outfitRow(long userId) {
        List<Map<String, String>> rows = jdbc.query(
                "SELECT hat_item, top_item, bottom_item, shoes_item, face_item, back_item, accessory_item"
                        + " FROM wardrobe_outfits WHERE user_id = ?",
                (rs, rowNum) -> {
                    Map<String, String> row = new LinkedHashMap<>();
                    for (String slot : SLOTS) {
                        row.put(slot, rs.getString(slot + "_item"));
                    }
                    return row;
                },
                userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
