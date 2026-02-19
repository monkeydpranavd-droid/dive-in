"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const { id } = useParams();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);

  const [showCollabBox, setShowCollabBox] = useState(false);
  const [collabTitle, setCollabTitle] = useState("");
  const [collabMessage, setCollabMessage] = useState("");

  useEffect(() => {
    if (id) {
      getUser();
      fetchProfile();
      fetchPosts();
    }
  }, [id]);

  // =====================
  // GET USER
  // =====================
  async function getUser() {
    const { data } = await supabase.auth.getUser();
    const currentUser = data?.user || null;
    setUser(currentUser);

    if (currentUser) {
      checkFollow(currentUser.id);
    }
  }

  // =====================
  // FETCH PROFILE
  // =====================
  async function fetchProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error) setProfile(data);
  }

  // =====================
  // FETCH POSTS
  // =====================
  async function fetchPosts() {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    setPosts(data || []);
  }

  // =====================
  // FOLLOW CHECK
  // =====================
  async function checkFollow(myId) {
    const { data } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", myId)
      .eq("following_id", id)
      .maybeSingle();

    setIsFollowing(!!data);
  }

  // =====================
  // FOLLOW
  // =====================
  async function follow() {
    if (!user) return;

    await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: id,
    });

    await supabase.from("notifications").insert({
      user_id: id,
      sender_id: user.id,
      type: "follow",
      read: false
    });

    setIsFollowing(true);
  }

  async function unfollow() {
    if (!user) return;

    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", id);

    setIsFollowing(false);
  }

  // =====================
  // 🤝 SEND COLLAB REQUEST
  // =====================
  async function sendCollabRequest() {
    if (!user) return;

    if (user.id === id) {
      alert("You can't collaborate with yourself 😅");
      return;
    }

    if (!collabTitle.trim()) {
      alert("Please enter a project title");
      return;
    }

    if (!collabMessage.trim()) {
      alert("Please write a message");
      return;
    }

    const { data: existing } = await supabase
      .from("collab_requests")
      .select("*")
      .eq("sender_id", user.id)
      .eq("receiver_id", id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      alert("Request already sent!");
      return;
    }

    const { error } = await supabase
      .from("collab_requests")
      .insert({
        sender_id: user.id,
        receiver_id: id,
        title: collabTitle,
        message: collabMessage,
        status: "pending"
      });

    if (!error) {
      await supabase.from("notifications").insert({
        user_id: id,
        sender_id: user.id,
        type: "collab",
        read: false
      });

      alert("🤝 Collaboration request sent!");

      setCollabTitle("");
      setCollabMessage("");
      setShowCollabBox(false);
    }
  }

  // =====================
  // START CHAT
  // =====================
  async function startChat() {
    if (!user) return;

    const { data: myConvos } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myConvos?.length) {
      for (let c of myConvos) {
        const { data: match } = await supabase
          .from("conversation_participants")
          .select("*")
          .eq("conversation_id", c.conversation_id)
          .eq("user_id", id)
          .maybeSingle();

        if (match) {
          router.push(`/chat/${c.conversation_id}`);
          return;
        }
      }
    }

    const { data: convo } = await supabase
      .from("conversations")
      .insert({})
      .select()
      .single();

    await supabase.from("conversation_participants").insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: id },
    ]);

    router.push(`/chat/${convo.id}`);
  }

  if (!profile) return <p className="ds-loading">Loading...</p>;

  return (
    <div className="ds-page">

      <button
        className="ds-profile-back-btn"
        onClick={() => router.push("/dashboard")}
      >
        ⬅ Back
      </button>

      <div className="ds-profile-hero">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            width={128}
            height={128}
            className="ds-profile-avatar"
          />
        ) : (
          <div className="ds-profile-avatar-placeholder">👤</div>
        )}

        <h1 className="ds-profile-username">{profile.username}</h1>

        {user?.id !== id && (
          <>
            <div className="ds-profile-actions">
              {isFollowing ? (
                <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={unfollow}>
                  Unfollow
                </button>
              ) : (
                <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={follow}>
                  Follow
                </button>
              )}

              <button className="ds-btn ds-btn-success ds-btn-sm" onClick={startChat}>
                💬 Message
              </button>

              <button
                className="ds-btn ds-btn-warning ds-btn-sm"
                onClick={() => setShowCollabBox(!showCollabBox)}
              >
                🤝 Collaborate
              </button>
            </div>

            {showCollabBox && (
              <div className="ds-card mt-3 p-3">
                <input
                  className="ds-input w-full mb-2"
                  placeholder="Project Title"
                  value={collabTitle}
                  onChange={(e) => setCollabTitle(e.target.value)}
                />

                <textarea
                  className="ds-input w-full"
                  placeholder="Write your collaboration idea..."
                  value={collabMessage}
                  onChange={(e) => setCollabMessage(e.target.value)}
                  rows={3}
                />

                <button
                  className="ds-btn ds-btn-success mt-2"
                  onClick={sendCollabRequest}
                >
                  Send Request
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <h3 className="ds-h3">Posts</h3>

      {posts.length === 0 ? (
        <p className="ds-text-muted">No posts yet.</p>
      ) : (
        <div className="ds-profile-grid">
          {posts.map((post) => (
            <article key={post.id} className="ds-profile-post-card">
              {post.image_url ? (
                <img
                  src={post.image_url}
                  alt=""
                  className="ds-profile-post-card-image"
                />
              ) : (
                <div className="ds-profile-post-card-image-wrap">
                  <span className="ds-text-subtle">📷</span>
                </div>
              )}
              <div className="ds-profile-post-card-caption">
                <p><b>{post.caption || "No caption"}</b></p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}