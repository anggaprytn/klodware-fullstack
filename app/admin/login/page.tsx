"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      setError(
        "Username or password is incorrect, or admin access is not allowed.",
      );
      return;
    }

    router.replace("/admin/dashboard");
    router.refresh();
  }

  return (
    <main className="login-wrap">
      <video
        aria-hidden="true"
        className="login-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source
          src="https://testing-1355450658.cos.ap-jakarta.myqcloud.com/klodware-landing.mp4"
          type="video/mp4"
        />
      </video>
      <div className="login-overlay" aria-hidden="true" />
      <section className="login-panel" aria-labelledby="admin-login-title">
        <div className="login-context">
          <span className="login-badge">Secure Admin Access</span>
          <div>
            <h1 id="admin-login-title">Klodware Admin</h1>
            <p className="login-subtitle">Ship Maintenance Control Console</p>
          </div>
          <p className="login-copy">
            Manage vessels, inspection templates, submitted reports, and sync
            diagnostics.
          </p>
        </div>
        <form className="form login-form" onSubmit={onSubmit}>
          <div className="field login-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Enter username"
              required
            />
          </div>
          <div className="field login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              required
            />
          </div>
          <p className="error" role="alert">
            {error}
          </p>
          <button
            className="button login-button"
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="login-footnote">
          Field inspections are completed in the Klodware mobile app.
        </p>
      </section>
    </main>
  );
}
