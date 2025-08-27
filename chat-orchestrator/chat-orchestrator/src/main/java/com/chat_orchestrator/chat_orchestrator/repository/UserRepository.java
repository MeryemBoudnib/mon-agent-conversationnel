// src/main/java/com/chat_orchestrator/chat_orchestrator/repository/UserRepository.java
package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.dto.projection.UserSignupProjection;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    @Query(value = """
        SELECT DATE(u.created_at) AS date,
               COUNT(*)           AS count
        FROM users u
        WHERE DATE(u.created_at) BETWEEN :from AND :to
        GROUP BY DATE(u.created_at)
        ORDER BY DATE(u.created_at)
        """, nativeQuery = true)
    List<UserSignupProjection> findSignupsPerDay(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );
}
