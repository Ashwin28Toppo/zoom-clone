"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import "@/styles/dashboard.css";
import "@/styles/workplace_tabs.css";

export default function ChatPage() {
  const [recipient, setRecipient] = useState("");
  const [convName, setConvName] = useState("");
  const [message, setMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      <Navbar variant="workplace" />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar activeTab="chat" />

        <div className="zm-workplace-container" style={{ flex: 1 }}>
          {/* Middle Sub-Sidebar (Left panel matching Image 1) */}
          <aside className="zm-sub-sidebar">
            <div className="zm-chat-sub-header">
              <button type="button" className="zm-chat-title-btn">
                <span>Chat</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>▾</span>
              </button>

              <div className="zm-chat-sub-actions">
                <button type="button" className="zm-sub-icon-btn" title="Chat Settings">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                <button type="button" className="zm-new-chat-btn" title="New Chat">
                  +
                </button>
              </div>
            </div>

            {/* Filter Pills matching Image 1 */}
            <div className="zm-chat-filters">
              <button
                type="button"
                className={`zm-filter-pill ${activeFilter === "all" ? "active" : ""}`}
                onClick={() => setActiveFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`zm-filter-pill ${activeFilter === "mentions" ? "active" : ""}`}
                onClick={() => setActiveFilter("mentions")}
              >
                @
              </button>
              <button
                type="button"
                className={`zm-filter-pill ${activeFilter === "dms" ? "active" : ""}`}
                onClick={() => setActiveFilter("dms")}
              >
                💬
              </button>
              <button
                type="button"
                className={`zm-filter-pill ${activeFilter === "more" ? "active" : ""}`}
                onClick={() => setActiveFilter("more")}
              >
                ⋯
              </button>
            </div>

            {/* Accordion Categories matching Image 1 */}
            <div className="zm-chat-accordion-list">
              <div className="zm-chat-accordion-item">
                <span style={{ fontSize: 10 }}>∨</span>
                <span>Apps</span>
              </div>
              <div className="zm-chat-accordion-item">
                <span style={{ fontSize: 10 }}>›</span>
                <span>Chats & Channels</span>
              </div>
              <div className="zm-chat-accordion-item">
                <span style={{ fontSize: 10 }}>›</span>
                <span>Starred</span>
              </div>
              <div className="zm-chat-accordion-item">
                <span style={{ fontSize: 10 }}>›</span>
                <span>Shared spaces</span>
              </div>
            </div>
          </aside>

          {/* Right Main Panel matching Image 1 */}
          <main className="zm-workplace-main">
            <div className="zm-chat-main-header">
              <span className="zm-chat-main-title">New message</span>
              <button type="button" className="zm-sub-icon-btn" title="Close">
                ✕
              </button>
            </div>

            <div className="zm-chat-input-row">
              <label htmlFor="input-to">To:</label>
              <input
                id="input-to"
                type="text"
                className="zm-chat-seamless-input"
                placeholder="Username, channel or email address"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            <div className="zm-chat-input-row">
              <input
                type="text"
                className="zm-chat-seamless-input"
                placeholder="Conversation name (optional)"
                value={convName}
                onChange={(e) => setConvName(e.target.value)}
              />
            </div>

            {/* Center Waving Graphic */}
            <div className="zm-chat-center-banner">
              <div className="zm-chat-waving-hand">
                <svg viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="40" fill="#e0efff" />
                  <rect x="58" y="24" width="34" height="24" rx="12" fill="#0e71eb" />
                  <text x="75" y="41" fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">Hi</text>
                  <path
                    d="M48 38c0-3-3-4-5-4s-4 2-4 5v14c-1-2-3-4-5-4s-4 2-4 5v12c0 9 7 16 16 16s16-7 16-16V48c0-3-2-5-5-5s-4 2-4 5v-8c0-3-3-4-5-4s-4 2-4 5v-3z"
                    fill="#a4cdfe"
                  />
                </svg>
              </div>
              <p className="zm-chat-banner-text">
                Starting a new group chat.<br />
                Begin composing a message below.
              </p>
            </div>

            {/* Bottom Composer Box matching Image 1 */}
            <div className="zm-chat-compose-container">
              <div className="zm-chat-compose-box">
                <textarea
                  className="zm-chat-compose-textarea"
                  placeholder="Write a message or type / for more"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <div className="zm-chat-compose-toolbar">
                  <div className="zm-chat-compose-tools">
                    <button type="button" className="zm-compose-tool-btn" title="Add">➕</button>
                    <button type="button" className="zm-compose-tool-btn" title="Format">Aa</button>
                    <button type="button" className="zm-compose-tool-btn" title="Emoji">😊</button>
                    <button type="button" className="zm-compose-tool-btn" title="Attach">📎</button>
                    <button type="button" className="zm-compose-tool-btn" title="Snippet">📄</button>
                  </div>

                  <button
                    type="button"
                    className={`zm-chat-send-btn ${message.trim() ? "active" : ""}`}
                    onClick={() => {
                      if (message.trim()) {
                        alert(`Message sent: "${message}"`);
                        setMessage("");
                      }
                    }}
                    title="Send"
                  >
                    ➤
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
