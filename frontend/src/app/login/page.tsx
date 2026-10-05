"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { loginUser } from "@/lib/api";
import "@/styles/auth.css";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect already-authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await loginUser({ email: email.trim(), password });
      login(res.access_token, res.user);
      router.push("/dashboard");
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    }
  }

  if (isLoading) return null;

  return (
    <div className="zm-auth-page">
      {/* Left decorative panel */}
      <div className="zm-auth-left">
        <div className="zm-auth-brand">
          <span className="zm-auth-brand-logo">zoom</span>
          <span className="zm-auth-brand-sub">Workplace</span>
          <p className="zm-auth-brand-tagline">One platform,<br />limitless potential</p>
          <p className="zm-auth-brand-desc">
            Video conferencing, team chat, phone, and more — all in one place
            so your team can connect, collaborate, and get things done.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="zm-auth-right">
        <div className="zm-auth-card">
          <h1 className="zm-auth-title">Sign in</h1>
          <p className="zm-auth-subtitle">
            New to Zoom?{" "}
            <Link href="/signup">Sign Up Free</Link>
          </p>

          {error && (
            <div className="zm-auth-error" style={{ marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <form className="zm-auth-form" onSubmit={handleSubmit}>
            <div className="zm-auth-field">
              <label className="zm-auth-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                className={`zm-auth-input ${error ? "error" : ""}`}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                autoFocus
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="zm-auth-field">
              <label className="zm-auth-label" htmlFor="auth-password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  className={`zm-auth-input ${error ? "error" : ""}`}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  required
                  disabled={isSubmitting}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              className="zm-auth-btn"
              disabled={isSubmitting || !email.trim() || !password}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="zm-auth-divider" style={{ marginTop: 24 }}>or</div>

          <p style={{ textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 16 }}>
            Joining a meeting?{" "}
            <Link href="/dashboard" style={{ color: "#0e72ed", fontWeight: 600, textDecoration: "none" }}>
              Join as Guest
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
