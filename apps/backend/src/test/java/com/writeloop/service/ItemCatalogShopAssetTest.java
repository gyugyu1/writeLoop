package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 메인 세션 테스트(작업 128 가구점 실내): 가구점 모델을 서버 목록에 넣은 것.
 * 실내·버들은 새 종류 애셋(모델 파일만, 배치·홈쇼핑·옷에 들지 않음), 진열 상품 셋은 팔지 않고 처음 가지지도 않는 가구다.
 */
class ItemCatalogShopAssetTest {

    private final ItemCatalog catalog = ItemCatalog.DEFAULT;

    @Test
    void 애셋_둘은_모델_파일만_있고_배치_검사_홈쇼핑_옷에_들지_않는다() {
        for (String id : List.of("shopInterior", "shopkeeperBeodeul")) {
            ItemCatalog.Item item = catalog.find(id);
            assertThat(item).isNotNull();
            assertThat(item.isAsset()).isTrue();
            assertThat(item.draw()).isNull();
            assertThat(item.price()).isNull();
            assertThat(catalog.assetsOf(id).model().url()).startsWith(ItemCatalog.FILES_PATH).endsWith(".glb");
            assertThat(catalog.assetsOf(id).icon()).isNull();
            assertThat(catalog.furnitureKinds()).doesNotContainKey(id);
            assertThat(catalog.wearableSlots()).doesNotContainKey(id);
            assertThat(catalog.products()).doesNotContain(item);
        }
    }

    @Test
    void 진열_상품_셋은_팔지_않고_처음_가지지도_않는_바닥_가구다() {
        for (String id : List.of("walnutBed", "grandmasFloorBedding", "cloudDesk")) {
            ItemCatalog.Item item = catalog.find(id);
            assertThat(item).isNotNull();
            assertThat(item.isFurniture()).isTrue();
            assertThat(item.sold()).isFalse();
            assertThat(catalog.starterCounts()).doesNotContainKey(id);
            assertThat(catalog.furnitureKinds().get(id)).isEqualTo(new ItemCatalog.Furniture("floor", false, 0, false));
            assertThat(item.draw().path("model").path("piece").asText()).isEqualTo(id);
            assertThat(catalog.assetsOf(id).model().bytes()).isPositive();
        }
    }

    @Test
    void 가구점_파일은_파일_API로_받을_수_있다() {
        for (String id : List.of("shopInterior", "shopkeeperBeodeul", "walnutBed", "grandmasFloorBedding", "cloudDesk")) {
            ItemCatalog.Asset model = catalog.assetsOf(id).model();
            ItemCatalog.StoredFile file = catalog.file(model.url().substring(ItemCatalog.FILES_PATH.length()));
            assertThat(file).isNotNull();
            assertThat(file.contentType()).isEqualTo("model/gltf-binary");
            assertThat((long) file.content().length).isEqualTo(model.bytes());
        }
    }
}
