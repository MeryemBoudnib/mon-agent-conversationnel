package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.dto.UserSignupDTO;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.*;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    /** Projection native Postgres : CAST(created_at AS date) */
    @Query(value = """
            SELECT CAST(u.created_at AS date) AS date, COUNT(*) AS count
            FROM users u
            WHERE CAST(u.created_at AS date) BETWEEN :from AND :to
            GROUP BY CAST(u.created_at AS date)
            ORDER BY CAST(u.created_at AS date)
            """, nativeQuery = true)
    List<Map<String,Object>> findSignupsPerDayNative(@Param("from") LocalDate from,
                                                     @Param("to") LocalDate to);
}
