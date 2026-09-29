"use client";

import React, { use } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import "@/styles/dashboard.css";

interface PrejoinPageProps {
  params: Promise<{ meetingId: string }>;
}

export default function PrejoinPage({ params }: PrejoinPageProps) {
  const resolvedParams = use(params);
  const meetingId = resolvedParams.meetingId;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#1e2022" }}>
      <Navbar />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: 32,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 8px 30px rgba(0,0,0,0.3)"
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#1e2022" }}>
            Ready to join meeting?
          </h2>
          <p style={{ color: "#6e7687", fontSize: 14, marginBottom: 20 }}>
            Meeting ID: <code style={{ backgroundColor: "#f0f2f5", padding: "4px 8px", borderRadius: 4, fontWeight: 700 }}>{meetingId}</code>
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              href="/dashboard"
              className="zm-modal-btn cancel"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Back to Dashboard
            </Link>
            <Link
              href={`/meeting/${meetingId}`}
              className="zm-modal-btn primary"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Enter Room
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
