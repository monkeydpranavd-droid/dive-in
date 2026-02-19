"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function EditProfile() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getProfile();
  }, []);

  // ✅ GET USER + PROFILE
  async function getProfile() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
      return;
    }

    setUser(data.user);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", data.user.id)
      .single();

    if (profile) {
      setUsername(profile.username || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }

  // ✅ AVATAR UPLOAD
  async function uploadAvatar(e) {
    try {
      setUploading(true);

      const file = e.target.files[0];
      if (!file) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}.${fileExt}`;

      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setAvatarUrl(data.publicUrl);

    } catch (err) {
      alert("Upload failed");
      console.log(err);
    } finally {
      setUploading(false);
    }
  }

  // ✅ SAVE PROFILE
  async function saveProfile() {
    await supabase.from("profiles").upsert({
      id: user.id,
      username: username,
      avatar_url: avatarUrl,
    });

    alert("Profile updated!");
    router.push("/dashboard");
  }

  return (
    <div className="ds-page">
      <div className="ds-card max-w-[500px]">
        <h2 className="ds-h2">✏️ Edit Profile</h2>

        {avatarUrl && (
          <img
            src={avatarUrl}
            width={120}
            height={120}
            alt="Avatar"
            className="ds-avatar mb-5 block"
          />
        )}

        <div className="ds-form-group">
          <label>Upload Avatar</label>
          <input
            type="file"
            onChange={uploadAvatar}
            className="ds-input"
            accept="image/*"
          />
          {uploading && <p className="ds-text-muted mt-2">Uploading...</p>}
        </div>

        <div className="ds-form-group">
          <label>Username</label>
          <input
            className="ds-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
          />
        </div>

        <div className="ds-form-row mt-4">
          <button className="ds-btn ds-btn-primary" onClick={saveProfile}>
            Save Profile
          </button>
          <button className="ds-btn ds-btn-secondary" onClick={() => router.push("/dashboard")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}