"use client";

import React, { useState, useEffect } from "react";

export default function DashboardClock() {
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      // Format: 1:25 AM
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      );
      // Format: Wednesday, September 30
      setDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      );
    }

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="zm-clock-section">
      <div className="zm-clock-time">{timeStr || "--:-- --"}</div>
      <div className="zm-clock-date">{dateStr || "Loading..."}</div>
    </section>
  );
}
