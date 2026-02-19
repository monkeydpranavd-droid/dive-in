"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    alert("Login success!");
    router.push("/dashboard"); // ✅ redirect
    setLoading(false);
  };

  return (
    <div className="ds-page flex min-h-screen flex-col items-center justify-center">
      <div className="ds-card w-full max-w-[400px]">
        <h1 className="ds-h1 text-center">Login</h1>

        <div className="ds-form-group">
          <input
            className="ds-input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="ds-form-group">
          <input
            className="ds-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          className="ds-btn ds-btn-primary w-full"
          onClick={login}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="ds-text-muted mt-4 text-center text-sm">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="ds-link">Sign up</a>
        </p>
      </div>
    </div>
  );
}