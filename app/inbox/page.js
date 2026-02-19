"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Inbox() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUser();
  }, []);

  async function getUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.push("/login");

    setUser(data.user);
    fetchConversations(data.user.id);
  }

  // ✅ REALTIME REFRESH WHEN NEW MESSAGE ARRIVES
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("inbox-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function fetchConversations(userId) {
    setLoading(true);

    const { data: myConvos, error } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (error || !myConvos?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = myConvos.map(c => c.conversation_id);

    const convoData = await Promise.all(
      convoIds.map(async (convoId) => {

        // ✅ Get all participants of this conversation
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("*")
          .eq("conversation_id", convoId);

        // Find the other user
        const other = participants?.find(p => p.user_id !== userId);

        let profile = null;

        if (other) {
          const { data } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", other.user_id)
            .single();

          profile = data;
        }

        // ✅ Get last message
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          conversation_id: convoId,
          user: profile,
          lastMessage: lastMessage?.content || "Start conversation",
          lastTime: lastMessage?.created_at || null
        };
      })
    );

    // Sort by latest message
    convoData.sort((a, b) => {
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return new Date(b.lastTime) - new Date(a.lastTime);
    });

    setConversations(convoData);
    setLoading(false);
  }

  if (!user) return null;

  return (
    <div className="ds-dashboard-page">
      <header className="ds-dashboard-header">
        <div className="ds-dashboard-header-inner">
          <h2>📥 Inbox</h2>
        </div>
      </header>

      <main className="ds-dashboard-content">

        {loading && <p>Loading...</p>}

        {!loading && conversations.length === 0 && (
          <p className="ds-text-muted">No conversations yet</p>
        )}

        {conversations.map(convo => (
          <div
            key={convo.conversation_id}
            className="ds-card cursor-pointer mb-3 flex items-center gap-3"
            onClick={() => router.push(`/chat/${convo.conversation_id}`)}
          >
            <img
              src={convo.user?.avatar_url || "/default-avatar.png"}
              width={40}
              height={40}
              className="ds-avatar w-10 h-10"
              alt=""
            />
            <div>
              <div className="font-semibold">
                {convo.user?.username || "Unknown User"}
              </div>
              <div className="ds-text-muted text-sm">
                {convo.lastMessage}
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}