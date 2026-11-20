package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 메인 세션 테스트(작업 128 가구점 실내 14 결정, 130 새 매장): 가구점 진열 상품 여섯을 서버 목록에 넣은 것.
 * 상품은 팔지 않고 처음 가지지도 않는 가구(장화 화분만 탁상)이고, 모델과 명패 그림을 앱이 파일 API로 받는다. 실내·주인 버들은 앱에 들어 있어 목록에 없다.
 */
class ItemCatalogShopAssetTest {

    private static final List<String> PRODUCTS = List.of("rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk");

    private final ItemCatalog catalog = ItemCatalog.DEFAULT;

    @Test
    void 진열_상품_셋은_팔지_않고_처음_가지지도_않는_바닥_가구다() {
        for (String id : PRODUCTS) {
            ItemCatalog.Item item = catalog.find(id);
            assertThat(item).isNotNull();
            assertThat(item.isFurniture()).isTrue();
            assertThat(item.sold()).isFalse();
            assertThat(catalog.products()).doesNotContain(item);
            assertThat(catalog.starterCounts()).doesNotContainKey(id);
            String mount = id.equals("rainbootPlanter") ? "tabletop" : "floor";
            assertThat(catalog.furnitureKinds().get(id)).isEqualTo(new ItemCatalog.Furniture(mount, false, 0, false));
            assertThat(catalog.assetsOf(id).nameplate().url()).startsWith(ItemCatalog.FILES_PATH).endsWith(".png");
            assertThat(item.draw().path("model").path("piece").asText()).isEqualTo(id);
            assertThat(catalog.assetsOf(id).icon()).isNull();
        }
    }

    @Test
    void 진열_상품_모델과_명패_그림은_파일_API로_받을_수_있다() {
        for (String id : PRODUCTS) {
            ItemCatalog.Asset model = catalog.assetsOf(id).model();
            ItemCatalog.StoredFile file = catalog.file(model.url().substring(ItemCatalog.FILES_PATH.length()));
            assertThat(file).isNotNull();
            assertThat(file.contentType()).isEqualTo("model/gltf-binary");
            assertThat((long) file.content().length).isEqualTo(model.bytes());
            ItemCatalog.Asset nameplate = catalog.assetsOf(id).nameplate();
            ItemCatalog.StoredFile png = catalog.file(nameplate.url().substring(ItemCatalog.FILES_PATH.length()));
            assertThat(png.contentType()).isEqualTo("image/png");
            assertThat((long) png.content().length).isEqualTo(nameplate.bytes());
        }
    }

    @Test
    void 진열_상품_이름은_애셋_폴더_이름을_띄어_쓴다() {
        assertThat(PRODUCTS.stream().map(id -> catalog.find(id).name()).toList())
                .containsExactly("장화 화분", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상");
        assertThat(catalog.assetsOf("bed").nameplate()).isNull();
    }

    @Test
    void 실내와_버들은_목록에_없다() {
        assertThat(catalog.find("shopInterior")).isNull();
        assertThat(catalog.find("shopkeeperBeodeul")).isNull();
        assertThat(catalog.items()).allMatch(item -> item.isFurniture() || item.isWearable());
    }
}
