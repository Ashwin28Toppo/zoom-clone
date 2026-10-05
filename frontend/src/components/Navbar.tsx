"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NavbarProps {
  variant?: "workplace" | "portal";
  onOpenJoin?: () => void;
}

function UserDropdown({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    onClose();
    router.push("/login");
  }

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        minWidth: 220,
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {/* User info header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #0e72ed, #1a5bcc)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: "6px 0" }}>
        <button
          id="btn-logout"
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 16px",
            background: "none",
            border: "none",
            fontSize: 14,
            color: "#374151",
            cursor: "pointer",
            textAlign: "left",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Navbar({ variant = "workplace", onOpenJoin }: NavbarProps) {
  const { user, isAuthenticated } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const AvatarButton = (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <div
        className="zm-avatar-wrapper"
        title={user?.name || "User"}
        onClick={() => setShowDropdown((v) => !v)}
        style={{ cursor: "pointer" }}
      >
        <div className="zm-avatar">{initials}</div>
        <span className="zm-online-badge" />
      </div>
      {showDropdown && <UserDropdown onClose={() => setShowDropdown(false)} />}
    </div>
  );

  if (variant === "portal") {
    return (
      <header className="zm-header" style={{ borderBottom: "1px solid #e4e7eb" }}>
        <div className="zm-header-left" style={{ gap: 28 }}>
          <Link href="/dashboard" className="zm-brand" style={{ textDecoration: "none" }}>
            <span className="zm-brand-logo" style={{ fontSize: 26 }}>zoom</span>
          </Link>
        </div>

        <div className="zm-header-right" style={{ gap: 20 }}>
          {isAuthenticated ? (
            AvatarButton
          ) : (
            <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: "#0e72ed", textDecoration: "none" }}>
              Sign In
            </Link>
          )}
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
        <button className="zm-icon-btn" title="Notifications" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        {isAuthenticated ? (
          AvatarButton
        ) : (
          <Link href="/login" style={{ fontSize: 14, fontWeight: 600, color: "#0e72ed", textDecoration: "none" }}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
