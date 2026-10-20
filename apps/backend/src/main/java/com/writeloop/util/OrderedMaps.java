package com.writeloop.util;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 넣은 순서를 그대로 유지하는 불변 Map을 만든다.
 *
 * <p>{@code Map.of}, {@code Map.ofEntries}, {@code Map.copyOf}가 만드는 Map은 JVM을 시작할 때마다
 * 순회 순서가 무작위로 달라진다. LLM에 보내는 JSON 스키마와 프롬프트는 Map의 순회 순서가 그대로
 * JSON 키 순서가 되고, 구조화 출력에서는 그 순서가 모델이 답을 쓰는 순서가 된다.
 * 그래서 LLM 요청을 만드는 코드는 이 클래스로 Map을 만든다.
 *
 * <p>사용법은 {@code Map.of}와 같다. {@code Map.of}처럼 null 키·값과 중복 키를 거부한다.
 */
public final class OrderedMaps {

    private OrderedMaps() {
    }

    public static <K, V> Map<K, V> of() {
        return build();
    }

    public static <K, V> Map<K, V> of(K k1, V v1) {
        return build(k1, v1);
    }

    public static <K, V> Map<K, V> of(K k1, V v1, K k2, V v2) {
        return build(k1, v1, k2, v2);
    }

    public static <K, V> Map<K, V> of(K k1, V v1, K k2, V v2, K k3, V v3) {
        return build(k1, v1, k2, v2, k3, v3);
    }

    public static <K, V> Map<K, V> of(K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4);
    }

    public static <K, V> Map<K, V> of(K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4, K k5, V v5) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4, k5, v5);
    }

    public static <K, V> Map<K, V> of(
            K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4, K k5, V v5,
            K k6, V v6
    ) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4, k5, v5, k6, v6);
    }

    public static <K, V> Map<K, V> of(
            K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4, K k5, V v5,
            K k6, V v6, K k7, V v7
    ) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4, k5, v5, k6, v6, k7, v7);
    }

    public static <K, V> Map<K, V> of(
            K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4, K k5, V v5,
            K k6, V v6, K k7, V v7, K k8, V v8
    ) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4, k5, v5, k6, v6, k7, v7, k8, v8);
    }

    public static <K, V> Map<K, V> of(
            K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4, K k5, V v5,
            K k6, V v6, K k7, V v7, K k8, V v8, K k9, V v9
    ) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4, k5, v5, k6, v6, k7, v7, k8, v8, k9, v9);
    }

    public static <K, V> Map<K, V> of(
            K k1, V v1, K k2, V v2, K k3, V v3, K k4, V v4, K k5, V v5,
            K k6, V v6, K k7, V v7, K k8, V v8, K k9, V v9, K k10, V v10
    ) {
        return build(k1, v1, k2, v2, k3, v3, k4, v4, k5, v5, k6, v6, k7, v7, k8, v8, k9, v9, k10, v10);
    }

    @SafeVarargs
    public static <K, V> Map<K, V> ofEntries(Map.Entry<? extends K, ? extends V>... entries) {
        Map<K, V> map = new LinkedHashMap<>();
        for (Map.Entry<? extends K, ? extends V> entry : entries) {
            Objects.requireNonNull(entry, "entry");
            putUnique(map, entry.getKey(), entry.getValue());
        }
        return Collections.unmodifiableMap(map);
    }

    /** 원본 Map의 순회 순서를 유지한 불변 사본을 만든다. 원본이 LinkedHashMap이면 넣은 순서가 유지된다. */
    public static <K, V> Map<K, V> copyOf(Map<? extends K, ? extends V> source) {
        Objects.requireNonNull(source, "source");
        Map<K, V> map = new LinkedHashMap<>();
        for (Map.Entry<? extends K, ? extends V> entry : source.entrySet()) {
            putUnique(map, entry.getKey(), entry.getValue());
        }
        return Collections.unmodifiableMap(map);
    }

    @SuppressWarnings("unchecked")
    private static <K, V> Map<K, V> build(Object... keysAndValues) {
        Map<K, V> map = new LinkedHashMap<>();
        for (int index = 0; index < keysAndValues.length; index += 2) {
            putUnique(map, (K) keysAndValues[index], (V) keysAndValues[index + 1]);
        }
        return Collections.unmodifiableMap(map);
    }

    private static <K, V> void putUnique(Map<K, V> map, K key, V value) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(value, "value");
        if (map.putIfAbsent(key, value) != null) {
            throw new IllegalArgumentException("duplicate key: " + key);
        }
    }
}
