"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error || "Could not sign in.");
      setIsSubmitting(false);

      return;
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>ClinQuery</h1>
        <p>Enter the app password to use this workspace.</p>
        <label>
          Password
          <input
            type="password"
            value={password}
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" disabled={!password || isSubmitting}>
          {isSubmitting ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
