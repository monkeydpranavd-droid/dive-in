"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RequestsPage() {
  const [requests, setRequests] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    getUser();
  }, []);

  useEffect(() => {
    if (user) fetchRequests();
  }, [user]);

  async function getUser() {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from("collab_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setRequests(data);
  }

  return (
    <div className="ds-page">
      <h2 className="ds-h2">🤝 Collaboration Requests</h2>

      {requests.length === 0 && <p className="ds-text-muted">No requests yet.</p>}

      {requests.map((req) => (
        <div key={req.id} className="ds-card mb-4">
          <p className="ds-text-muted"><b className="text-white">Status:</b> {req.status}</p>
          <p className="ds-text-muted mt-2">
            <b className="text-white">Created:</b> {new Date(req.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}