"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [commentInputs, setCommentInputs] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [expandedComments, setExpandedComments] = useState({});
  const notifRef = useRef(null);

  function toggleComments(postId) {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }

  // =====================
  // GET USER
  // =====================
  useEffect(() => { getUser(); }, []);

  async function getUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.push("/login");

    setUser(data.user);
    fetchNotifications(data.user.id);
    subscribeNotifications(data.user.id);
  }

  // =====================
  // REALTIME NOTIFICATIONS
  // =====================
  function subscribeNotifications(uid) {
    supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (p) => {
          if (p.new.user_id === uid) {
            setNotifications(prev => [p.new, ...prev]);
          }
        }
      )
      .subscribe();
  }

  async function markNotificationsRead() {
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id);

    fetchNotifications(user.id);
  }

  async function fetchNotifications(uid) {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .eq("read", false)
      .order("created_at", { ascending: false });

    setNotifications(data || []);
  }

  // =====================
  // FETCH POSTS
  // =====================
  useEffect(() => {
    if (user) fetchPosts();
  }, [user, selectedNiche]);

  async function fetchPosts() {
    setLoading(true);

    let query = supabase
      .from("posts")
      .select(`*, profiles(username)`)
      .order("created_at", { ascending: false });

    if (selectedNiche !== "all") {
      query = query.ilike("niche", `%${selectedNiche}%`);
    }

    const { data } = await query;

    const enriched = await Promise.all((data || []).map(async post => {
      const { count } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id);

      const { data: liked } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: comments } = await supabase
        .from("comments")
        .select(`*, profiles(username)`)
        .eq("post_id", post.id);

      return {
        ...post,
        likeCount: count || 0,
        liked: !!liked,
        comments: comments || []
      };
    }));

    setPosts(enriched);
    setLoading(false);
  }

  // =====================
  // REALTIME COMMENTS
  // =====================
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("comments")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        fetchPosts
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // =====================
  // LIKE
  // =====================
  async function toggleLike(post) {
    if (post.liked) {
      await supabase.from("likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({
        post_id: post.id,
        user_id: user.id
      });
    }
    fetchPosts();
  }

  // =====================
  // COMMENT
  // =====================
  async function addComment(postId) {
    const text = commentInputs[postId];
    if (!text) return;

    await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: text
    });

    setCommentInputs({ ...commentInputs, [postId]: "" });
    fetchPosts();
  }

  async function deleteComment(id) {
    await supabase.from("comments")
      .delete()
      .eq("id", id);
    fetchPosts();
  }

  // =====================
  // SEARCH
  // =====================
  useEffect(() => {
    const d = setTimeout(searchUsers, 400);
    return () => clearTimeout(d);
  }, [search]);

  async function searchUsers() {
    if (!search) return setResults([]);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${search}%`);

    setResults(data || []);
  }

  // =====================
  // CHAT
  // =====================
  async function startChat(otherUserId) {
    const { data: existing } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (existing?.length) {
      for (let c of existing) {
        const { data: match } = await supabase
          .from("conversation_participants")
          .select("*")
          .eq("conversation_id", c.conversation_id)
          .eq("user_id", otherUserId)
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
      { conversation_id: convo.id, user_id: otherUserId }
    ]);

    router.push(`/chat/${convo.id}`);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (showNotif && notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotif]);

  if (!user) return null;

  return (
    <div className="ds-dashboard-page">

      {/* FIXED HEADER */}
      <header className="ds-dashboard-header">
        <div className="ds-dashboard-header-inner">
          <button className="ds-dashboard-header-btn" onClick={() => router.push("/create-post")} title="Create post">➕</button>
          <button className="ds-dashboard-header-btn" onClick={() => router.push("/edit-profile")} title="Edit profile">✏️</button>

          <div className="ds-notif-dropdown-wrapper" ref={notifRef}>
            <button
              className="ds-dashboard-header-btn"
              onClick={() => {
                setShowNotif(!showNotif);
                markNotificationsRead();
              }}
              title="Notifications"
            >
              🔔 ({notifications.length})
            </button>
            {showNotif && (
              <div className="ds-notif-dropdown">
                {notifications.length === 0 && <p className="ds-text-muted p-3">No new notifications</p>}
                {notifications.map(n => (
                  <div key={n.id} className="ds-notif-item">
                    🔔 {n.type} from {n.sender_id}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="ds-dashboard-header-btn" onClick={() => router.push("/recommended-collaborators")} title="AI Matches">🤖</button>
          <button className="ds-dashboard-header-btn" onClick={() => router.push("/collab-requests")} title="Collaboration requests">🤝</button>
          <button className="ds-dashboard-header-btn" onClick={() => router.push("/inbox")} title="Inbox">💬</button>
          <button className="ds-dashboard-header-btn" onClick={logout} title="Logout">🚪</button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="ds-dashboard-content">

        {/* NICHE FILTER CHIPS */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            className={`ds-dashboard-chip ${selectedNiche === "all" ? "active" : ""}`}
            onClick={() => setSelectedNiche("all")}
          >All</button>
          <button
            className={`ds-dashboard-chip ${selectedNiche === "music" ? "active" : ""}`}
            onClick={() => setSelectedNiche("music")}
          >Music</button>
          <button
            className={`ds-dashboard-chip ${selectedNiche === "dance" ? "active" : ""}`}
            onClick={() => setSelectedNiche("dance")}
          >Dance</button>
          <button
            className={`ds-dashboard-chip ${selectedNiche === "writing" ? "active" : ""}`}
            onClick={() => setSelectedNiche("writing")}
          >Writing</button>
        </div>

        {/* SEARCH BAR */}
        <input
          className="ds-dashboard-search mb-4"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* SEARCH RESULTS */}
        {results.length > 0 && (
          <div className="ds-card mb-6">
            {results.map(r => (
              <div
                key={r.id}
                className="ds-search-item"
                onClick={() => router.push(`/profile/${r.id}`)}
              >
                <img src={r.avatar_url} alt="" className="ds-avatar w-8 h-8" width={32} height={32} />
                <span>{r.username}</span>
              </div>
            ))}
          </div>
        )}

        <h2 className="ds-h2">Feed</h2>

        {loading && <p className="ds-loading">Loading...</p>}

        {/* POST CARDS */}
        {posts.map(post => (
          <article key={post.id} className="ds-post-card">
            <div className="ds-post-header">
              <b
                className="ds-post-username"
                onClick={() => router.push(`/profile/${post.user_id}`)}
              >
                {post.profiles?.username}
              </b>
            </div>

            {post.image_url && (
              <div className="ds-post-card-image">
                <img src={post.image_url} alt="" />
              </div>
            )}

            <p className="ds-text-muted">{post.caption}</p>

            <div className="ds-post-card-actions">
              <button className="ds-post-card-btn ds-post-card-btn-ghost ds-like-btn" onClick={() => toggleLike(post)}>
                {post.liked ? "❤️" : "🤍"} {post.likeCount}
              </button>

              <button className="ds-post-card-btn ds-post-card-btn-ghost ds-like-btn" onClick={() => toggleComments(post.id)} title="Comments">
                💬 {post.comments?.length || 0}
              </button>

              {expandedComments[post.id] && (
                <>
                  {post.comments.map(c => (
                    <div key={c.id} className="ds-text-muted mt-2 text-sm w-full">
                      <b className="text-white">{c.profiles?.username}:</b> {c.content}
                      {c.user_id === user.id && (
                        <button className="ds-post-card-btn ds-post-card-btn-ghost ml-1 inline p-1" onClick={() => deleteComment(c.id)}>❌</button>
                      )}
                    </div>
                  ))}
                  <div className="ds-post-comment-row w-full">
                    <input
                      className="ds-input"
                      placeholder="Add a comment..."
                      value={commentInputs[post.id] || ""}
                      onChange={e => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                    />
                    <button className="ds-post-card-btn ds-post-card-btn-secondary" onClick={() => addComment(post.id)}>Post</button>
                  </div>
                </>
              )}

              {post.user_id !== user.id && (
                <button className="ds-post-card-btn ds-post-card-btn-ghost" onClick={() => startChat(post.user_id)}>Message</button>
              )}
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}