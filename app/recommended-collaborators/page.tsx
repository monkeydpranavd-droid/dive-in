"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Recommended() {
  const router = useRouter();
  const [user,setUser] = useState(null);
  const [matches,setMatches] = useState([]);

  useEffect(()=>{ init(); },[]);

  async function init(){
    const { data } = await supabase.auth.getUser();
    if(!data.user) return;

    setUser(data.user);
    findMatches(data.user.id);
  }

  async function findMatches(uid){

    // current user profile
    const { data: me } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if(!me) return;

    // find similar creators
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", uid)
      .or(`niche.ilike.%${me.niche}%,skills.ilike.%${me.skills}%`)
      .limit(10);

    setMatches(data || []);
  }

  return (
    <div style={{maxWidth:600,margin:"auto",padding:20}}>

      <h2>🤖 AI Collaborator Matches</h2>

      {matches.map(m=>(
        <div key={m.id}
          style={{
            border:"1px solid gray",
            padding:12,
            marginTop:12,
            borderRadius:8
          }}
        >
          <b>{m.username}</b>

          <p>🎯 Niche: {m.niche}</p>
          <p>🛠 Skills: {m.skills}</p>

          <button
            onClick={()=>router.push(`/profile/${m.id}`)}
          >
            View Profile
          </button>
        </div>
      ))}

    </div>
  );
}