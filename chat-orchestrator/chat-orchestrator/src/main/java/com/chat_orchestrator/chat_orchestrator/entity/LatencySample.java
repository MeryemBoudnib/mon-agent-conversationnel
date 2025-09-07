// entity/LatencySample.java
package com.chat_orchestrator.chat_orchestrator.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "bot_latency_samples")
public class LatencySample {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant ts;          // horodatage du sample

    @Column(nullable = false)
    private double latencySec;   // latence en secondes

    // getters/setters
    public Long getId() { return id; }
    public Instant getTs() { return ts; }
    public void setTs(Instant ts) { this.ts = ts; }
    public double getLatencySec() { return latencySec; }
    public void setLatencySec(double latencySec) { this.latencySec = latencySec; }
}
