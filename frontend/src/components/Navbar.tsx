"use client";

import React from "react";
import Link from "next/link";

interface NavbarProps {
  variant?: "workplace" | "portal";
  onOpenJoin?: () => void;
}

export default function Navbar({ variant = "workplace", onOpenJoin }: NavbarProps) {
  if (variant === "portal") {
    return (
      <header className="zm-header" style={{ borderBottom: "1px solid #e4e7eb" }}>
        <div className="zm-header-left" style={{ gap: 28 }}>
          <Link href="/dashboard" className="zm-brand" style={{ textDecoration: "none" }}>
            <span className="zm-brand-logo" style={{ fontSize: 26 }}>zoom</span>
          </Link>

          <nav style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 500, color: "#4a5568" }}>
            <span style={{ cursor: "pointer" }}>Products</span>
            <span style={{ cursor: "pointer" }}>Solutions</span>
            <span style={{ cursor: "pointer" }}>Resources</span>
            <span style={{ cursor: "pointer" }}>Plans & Pricing</span>
          </nav>
        </div>

        <div className="zm-header-right" style={{ gap: 20 }}>
          <button
            onClick={onOpenJoin}
            style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, color: "#232333", cursor: "pointer" }}
          >
            Join
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#232333", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
            Host ▾
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#232333", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
            Web App ▾
          </span>

          <div className="zm-avatar-wrapper" title="Ashwin Toppo (Host)">
            <div className="zm-avatar">AT</div>
            <span className="zm-online-badge" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="zm-header">
      <div className="zm-header-left">
        <Link href="/dashboard" className="zm-brand" style={{ textDecoration: "none" }}>
          <span className="zm-brand-logo">zoom</span>
          <span className="zm-brand-sub">Workplace</span>
        </Link>
        <div className="zm-nav-arrows">
          <button className="zm-icon-btn" title="Back" aria-label="Back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="zm-icon-btn" title="Forward" aria-label="Forward">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button className="zm-icon-btn" title="History" aria-label="History">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="zm-header-center">
        <div className="zm-search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="zm-search-input"
            placeholder="Search"
            readOnly
          />
          <span className="zm-search-kbd">Ctrl+K</span>
        </div>
      </div>

      <div className="zm-header-right">
        <span className="zm-header-link">Admin Center</span>
        <button className="zm-pill-btn">Download</button>
        <button className="zm-pill-btn primary">Upgrade</button>
        <button className="zm-icon-btn" title="Notifications" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <div className="zm-avatar-wrapper" title="Ashwin Toppo (Host)">
          <div className="zm-avatar">AT</div>
          <span className="zm-online-badge" />
        </div>
      </div>
    </header>
  );
}
