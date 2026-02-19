"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ChatPage() {
  const { id: convoId } = useParams();

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const bottomRef = useRef(null);
  const channelRef = useRef(null);

  // =========================
  // GET USER
  // =========================
  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }
    getUser();
  }, []);

  // =========================
  // FETCH MESSAGES + SUBSCRIBE
  // =========================
  useEffect(() => {
    if (!convoId || !user) return;

    fetchMessages();

    // Clean previous subscription if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`chat-${convoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convoId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);

          // Mark as seen if it's not your message
          if (payload.new.sender_id !== user.id) {
            markSeen(payload.new.id);
          }

          scrollDown();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [convoId, user]);

  async function fetchMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollDown();
  }

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage() {
    if (!text.trim() || !user) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: convoId,
      sender_id: user.id,
      content: text,
      seen: false,
    });

    if (!error) {
      setText("");
    }
  }

  // =========================
  // SEEN STATUS
  // =========================
  async function markSeen(messageId) {
    if (!user) return;

    await supabase
      .from("messages")
      .update({ seen: true })
      .eq("id", messageId)
      .neq("sender_id", user.id);
  }

  // =========================
  // AUTO SCROLL
  // =========================
  function scrollDown() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  if (!user) return null;

  return (
    <div className="ds-chat-container">
      <h3 className="ds-h3">💬 Chat</h3>

      <div className="ds-chat-messages">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.sender_id === user.id ? "text-right" : "text-left"}
          >
            <div
              className={`ds-msg ${
                m.sender_id === user.id
                  ? "ds-msg-sent"
                  : "ds-msg-received"
              }`}
            >
              {m.content}
            </div>

            {m.sender_id === user.id && (
              <div className="ds-text-subtle mt-1 text-xs">
                {m.seen ? "✓✓ Seen" : "✓ Sent"}
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="ds-chat-input-row">
        <input
          className="ds-input flex-1"
          placeholder="Type message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
        />

        <button className="ds-btn ds-btn-primary" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}