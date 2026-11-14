package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HomeShoppingOrderRepository extends JpaRepository<HomeShoppingOrderEntity, Long> {

    /** 종류마다 산 개수. */
    @Query("select o.furnitureType as type, count(o) as count from HomeShoppingOrderEntity o where o.userId = :userId group by o.furnitureType")
    List<TypeCount> countByType(@Param("userId") Long userId);

    void deleteAllByUserId(Long userId);

    interface TypeCount {
        String getType();

        long getCount();
    }
}
