"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CreatePost() {
  const router = useRouter();

  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [skills, setSkills] = useState("");

  // 🔥 New states for collab
  const [postType, setPostType] = useState("normal");
  const [lookingFor, setLookingFor] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [deadline, setDeadline] = useState("");

  // ✅ NICHE STATE
  const [niche, setNiche] = useState("music");

  const [loading, setLoading] = useState(false);

  const createPost = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Login required");
      setLoading(false);
      return;
    }

    let imageUrl = "";

    // =========================
    // IMAGE UPLOAD (TO posts BUCKET)
    // =========================
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("posts") // ✅ YOUR EXISTING BUCKET
        .upload(fileName, imageFile);

      if (uploadError) {
        alert(uploadError.message);
        setLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("posts")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    // =========================
    // INSERT INTO DATABASE
    // =========================
    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      caption,
      image_url: imageUrl,
      skills,

      // Collab fields
      post_type: postType,
      looking_for: postType === "collab" ? lookingFor : null,
      project_goal: postType === "collab" ? projectGoal : null,
      deadline: postType === "collab" ? deadline : null,

      niche
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    alert("Post created!");
    router.push("/dashboard");
  };

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: "auto" }}>
      <h1>Create Post</h1>

      {/* POST TYPE SELECT */}
      <label>Post Type</label>
      <br />
      <select value={postType} onChange={(e) => setPostType(e.target.value)}>
        <option value="normal">Normal Post</option>
        <option value="collab">Collaboration Request</option>
      </select>

      <br /><br />

      {/* NICHE SELECT */}
      <label>Niche</label>
      <br />
      <select value={niche} onChange={(e) => setNiche(e.target.value)}>
        <option value="music">🎵 Music</option>
        <option value="dance">💃 Dance</option>
        <option value="writing">✍️ Writing</option>
        <option value="art">🎨 Art</option>
        <option value="video">🎥 Video</option>
      </select>

      <br /><br />

      {/* CAPTION */}
      <input
        placeholder="Caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        style={{ width: "100%" }}
      />

      <br /><br />

      {/* IMAGE FILE INPUT */}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setImageFile(e.target.files[0])}
      />

      <br /><br />

      {/* SKILLS */}
      <input
        placeholder="Skills (Singer, Editor...)"
        value={skills}
        onChange={(e) => setSkills(e.target.value)}
        style={{ width: "100%" }}
      />

      <br /><br />

      {/* COLLAB FIELDS */}
      {postType === "collab" && (
        <>
          <h3>Collaboration Details</h3>

          <input
            placeholder="Looking for (Singer, Dancer...)"
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            style={{ width: "100%" }}
          />

          <br /><br />

          <input
            placeholder="Project Goal"
            value={projectGoal}
            onChange={(e) => setProjectGoal(e.target.value)}
            style={{ width: "100%" }}
          />

          <br /><br />

          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{ width: "100%" }}
          />

          <br /><br />
        </>
      )}

      <button onClick={createPost} disabled={loading}>
        {loading ? "Posting..." : "Post"}
      </button>
    </div>
  );
}