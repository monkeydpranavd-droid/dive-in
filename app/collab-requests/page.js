"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Requests() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);

  // =====================
  // GET USER
  // =====================
  useEffect(() => {
    getUser();
  }, []);

  async function getUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    setUser(data.user);
    fetchRequests(data.user.id);
    subscribeRealtime(data.user.id);
  }

  // =====================
  // FETCH REQUESTS
  // =====================
  async function fetchRequests(uid) {
    const { data } = await supabase
      .from("collab_requests")
      .select("*")
      .eq("receiver_id", uid)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setRequests(data || []);
  }

  // =====================
  // REALTIME UPDATES
  // =====================
  function subscribeRealtime(uid) {
    supabase
      .channel("collab-requests")
      .on(
        "postgres_changes",
        {
          event: "*", // listen to insert + update
          schema: "public",
          table: "collab_requests",
        },
        (payload) => {
          if (payload.new?.receiver_id === uid) {
            fetchRequests(uid);
          }
        }
      )
      .subscribe();
  }

  // =====================
  // ACCEPT REQUEST
  // =====================
  async function accept(req) {
    if (!user) return;

    try {
      // 1️⃣ Update status
      await supabase
        .from("collab_requests")
        .update({ status: "accepted" })
        .eq("id", req.id);

      // 2️⃣ Notify sender
      await supabase.from("notifications").insert({
        user_id: req.sender_id,
        sender_id: user.id,
        type: "collab_accept",
        read: false
      });

      // 3️⃣ Check existing conversation
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
            .eq("user_id", req.sender_id)
            .maybeSingle();

          if (match) {
            router.push(`/chat/${c.conversation_id}`);
            return;
          }
        }
      }

      // 4️⃣ Create new conversation
      const { data: convo } = await supabase
        .from("conversations")
        .insert({})
        .select()
        .single();

      await supabase.from("conversation_participants").insert([
        { conversation_id: convo.id, user_id: user.id },
        { conversation_id: convo.id, user_id: req.sender_id },
      ]);

      fetchRequests(user.id);

      router.push(`/chat/${convo.id}`);

    } catch (err) {
      console.error("Accept error:", err);
      alert("Something went wrong");
    }
  }

  // =====================
  // REJECT REQUEST
  // =====================
  async function reject(id) {
    await supabase
      .from("collab_requests")
      .update({ status: "rejected" })
      .eq("id", id);

    fetchRequests(user.id);
  }

  // =====================
  // UI
  // =====================
  return (
    <div className="ds-page">
      <h2 className="ds-h2">🤝 Collaboration Requests</h2>

      {requests.length === 0 && (
        <p className="ds-text-muted">No pending requests</p>
      )}

      {requests.map((r) => (
        <div key={r.id} className="ds-card mb-4">
          
          {/* ✅ SHOW TITLE FROM collab_requests TABLE */}
          <p className="ds-text-muted">
            <b className="text-white">Project:</b> {r.title || "Untitled"}
          </p>

          <p className="ds-text-muted mt-2">
            <b className="text-white">Message:</b> {r.message || "Wants to collaborate"}
          </p>

          <div className="ds-form-row mt-4">
            <button
              className="ds-btn ds-btn-success ds-btn-sm"
              onClick={() => accept(r)}
            >
              Accept
            </button>

            <button
              className="ds-btn ds-btn-danger ds-btn-sm"
              onClick={() => reject(r.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}