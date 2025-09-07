package com.chat_orchestrator.chat_orchestrator.repository;

import com.chat_orchestrator.chat_orchestrator.entity.PasswordResetToken;
import com.chat_orchestrator.chat_orchestrator.entity.User;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(String token);

    // ⚠️ supprime les demandes en cours pour éviter les doublons
    @Modifying
    @Query("delete from PasswordResetToken t where t.user = :user and t.usedAt is null")
    void deleteActiveForUser(@Param("user") User user);
}
