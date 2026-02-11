"use client";

import { useEffect, useState } from "react";
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

  if (!user) return null;

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>

      {/* HEADER */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => router.push("/create-post")}>➕</button>
        <button onClick={() => router.push("/edit-profile")}>✏️</button>

        <button onClick={() => {
          setShowNotif(!showNotif);
          markNotificationsRead();
        }}>
          🔔 ({notifications.length})
        </button>

        <button onClick={()=>router.push("/recommended-collaborators")}>
          🤖 AI Matches
        </button>

        <button onClick={() => router.push("/collab-requests")}>🤝</button>
        <button onClick={() => router.push("/inbox")}>💬</button>
        <button onClick={logout}>🚪</button>
      </div>

      {/* NOTIFICATIONS PANEL */}
      {showNotif && (
        <div style={{
          border:"1px solid gray",
          padding:10,
          marginTop:10,
          borderRadius:8,
          background:"#111",
          color:"white"
        }}>
          {notifications.length === 0 && <p>No new notifications</p>}
          {notifications.map(n => (
            <div key={n.id}>
              🔔 {n.type} from {n.sender_id}
            </div>
          ))}
        </div>
      )}

      {/* NICHE FILTER (SPACING VERSION) */}
      <div style={{ marginTop: 10, display:"flex", gap:10, flexWrap:"wrap" }}>
        <button onClick={() => setSelectedNiche("all")}>All</button>
        <button onClick={() => setSelectedNiche("music")}>Music</button>
        <button onClick={() => setSelectedNiche("dance")}>Dance</button>
        <button onClick={() => setSelectedNiche("writing")}>Writing</button>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search users..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {results.map(r => (
        <div key={r.id}
          onClick={() => router.push(`/profile/${r.id}`)}
          style={{ cursor:"pointer", display:"flex", gap:10 }}>
          <img src={r.avatar_url} width={30} />
          {r.username}
        </div>
      ))}

      <h2>Feed</h2>

      {loading && <p>Loading...</p>}

      {posts.map(post => (
        <div key={post.id} style={{ border:"1px solid #333", padding:15, marginTop:15 }}>
          <b onClick={() => router.push(`/profile/${post.user_id}`)}>
            {post.profiles?.username}
          </b>

          {post.image_url && (
            <img src={post.image_url} style={{ width:"100%" }} />
          )}

          <p>{post.caption}</p>

          <button onClick={() => toggleLike(post)}>
            {post.liked ? "❤️" : "🤍"} {post.likeCount}
          </button>

          {post.comments.map(c => (
            <p key={c.id}>
              <b>{c.profiles?.username}:</b> {c.content}
              {c.user_id === user.id &&
                <button onClick={() => deleteComment(c.id)}>❌</button>}
            </p>
          ))}

          <input
            placeholder="Comment..."
            value={commentInputs[post.id] || ""}
            onChange={e =>
              setCommentInputs({ ...commentInputs, [post.id]: e.target.value })
            }
          />

          <button onClick={() => addComment(post.id)}>Post</button>

          {post.user_id !== user.id &&
            <button onClick={() => startChat(post.user_id)}>Message</button>}
        </div>
      ))}
    </div>
  );
}