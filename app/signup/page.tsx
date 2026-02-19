"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    setLoading(true);

    // 1️⃣ Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const user = data.user;

    // 2️⃣ Insert profile row
    if (user) {
      await supabase.from("users").insert({
        id: user.id,
        username: email.split("@")[0],
        avatar_url: "",
        bio: "",
      });
    }

    alert("Signup success!");
    router.push("/login");
    setLoading(false);
  };

  return (
    <div className="ds-page flex min-h-screen flex-col items-center justify-center">
      <div className="ds-card w-full max-w-[400px]">
        <h1 className="ds-h1 text-center">Sign Up</h1>

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
          onClick={signUp}
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>

        <p className="ds-text-muted mt-4 text-center text-sm">
          Already have an account?{" "}
          <a href="/login" className="ds-link">Login</a>
        </p>
      </div>
    </div>
  );
}