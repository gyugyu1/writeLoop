package com.writeloop.util;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OrderedMapsTest {

    @Test
    void ofKeepsInsertionOrder() {
        Map<String, Integer> map = OrderedMaps.of(
                "k10", 10, "k9", 9, "k8", 8, "k7", 7, "k6", 6,
                "k5", 5, "k4", 4, "k3", 3, "k2", 2, "k1", 1
        );

        assertThat(List.copyOf(map.keySet()))
                .containsExactly("k10", "k9", "k8", "k7", "k6", "k5", "k4", "k3", "k2", "k1");
    }

    @Test
    void ofEntriesKeepsInsertionOrder() {
        Map<String, String> map = OrderedMaps.ofEntries(
                Map.entry("status", "a"),
                Map.entry("reasonKo", "b"),
                Map.entry("answerAfter", "c")
        );

        assertThat(List.copyOf(map.keySet())).containsExactly("status", "reasonKo", "answerAfter");
    }

    @Test
    void copyOfKeepsSourceIterationOrder() {
        Map<String, String> source = new LinkedHashMap<>();
        source.put("definition", "a");
        source.put("semanticRole", "b");
        source.put("satisfiedWhen", "c");

        Map<String, String> copy = OrderedMaps.copyOf(source);
        source.put("extra", "d");

        assertThat(List.copyOf(copy.keySet())).containsExactly("definition", "semanticRole", "satisfiedWhen");
    }

    @Test
    void rejectsDuplicateKeysAndNullsLikeMapOf() {
        assertThatThrownBy(() -> OrderedMaps.of("type", "string", "type", "integer"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OrderedMaps.of("type", null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> OrderedMaps.of(null, "string"))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void resultIsUnmodifiable() {
        Map<String, String> map = OrderedMaps.of("type", "string");

        assertThatThrownBy(() -> map.put("other", "value"))
                .isInstanceOf(UnsupportedOperationException.class);
        assertThat(OrderedMaps.<String, String>of()).isEmpty();
    }
}
