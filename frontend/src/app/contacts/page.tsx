"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import "@/styles/dashboard.css";
import "@/styles/workplace_tabs.css";

export default function ContactsPage() {
  const [search, setSearch] = useState("");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      <Navbar variant="workplace" />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar activeTab="contacts" />

        <div className="zm-workplace-container" style={{ flex: 1 }}>
          {/* Middle Sub-Sidebar (Left panel matching Image 3) */}
          <aside className="zm-sub-sidebar">
            <div className="zm-contacts-search-bar">
              <div className="zm-contacts-search-input-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="zm-contacts-search-input"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="zm-contacts-plus-btn"
                title="Add Contact"
                onClick={() => alert("Add contact modal available.")}
              >
                +
              </button>
            </div>

            {/* Loading Indicator matching Image 3 */}
            <div className="zm-contacts-loading-area">
              <div className="zm-blue-spinner" />
              <span>Loading</span>
            </div>
          </aside>

          {/* Right Main Panel matching Image 3 */}
          <main className="zm-workplace-main">
            <div className="zm-contacts-center-panel">
              {/* Address Book Graphic with Colored Tabs matching Image 3 */}
              <div className="zm-contacts-book-card">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4" />
                </svg>

                {/* Colored Tabs (Red, Yellow, Green, Blue) matching Image 3 */}
                <div className="zm-contacts-tabs">
                  <div className="zm-book-tab red" />
                  <div className="zm-book-tab yellow" />
                  <div className="zm-book-tab green" />
                  <div className="zm-book-tab blue" />
                </div>
              </div>

              <p className="zm-contacts-placeholder-text">
                View Contact info by clicking a contact in the left panel
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
