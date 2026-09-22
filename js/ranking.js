// クリアタイム世界ランキング(Supabase)
(function(global){
  "use strict";
  const SUPABASE_URL = 'https://kifnzvktwbomxthzvvgy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZm56dmt0d2JvbXh0aHp2dmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzgxMzgsImV4cCI6MjA5MzQxNDEzOH0.M7nXP-u--6J_6rRpgz1cJj21_7KX6MtfTmZy77Xf_IE';
  const TABLE = 'heroquest_rankings';

  function isConfigured(){ return !!SUPABASE_URL && !!SUPABASE_ANON_KEY; }

  async function submitScore(name, clearSec, level){
    if(!isConfigured()) return {ok:false, reason:'not_configured'};
    try{
      const res = await fetch(SUPABASE_URL+'/rest/v1/'+TABLE, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization':'Bearer '+SUPABASE_ANON_KEY,
          'Prefer':'return=minimal'
        },
        body: JSON.stringify([{player_name:name, clear_seconds:Math.round(clearSec), level}])
      });
      return {ok:res.ok};
    }catch(e){ return {ok:false, reason:'network'}; }
  }

  async function fetchTop(limit){
    if(!isConfigured()) return {ok:false, rows:[]};
    try{
      const res = await fetch(SUPABASE_URL+'/rest/v1/'+TABLE+'?select=player_name,clear_seconds,level,created_at&order=clear_seconds.asc&limit='+(limit||20), {
        headers:{ 'apikey': SUPABASE_ANON_KEY, 'Authorization':'Bearer '+SUPABASE_ANON_KEY }
      });
      if(!res.ok) return {ok:false, rows:[]};
      const rows = await res.json();
      return {ok:true, rows};
    }catch(e){ return {ok:false, rows:[]}; }
  }

  global.Ranking = { isConfigured, submitScore, fetchTop };
})(window);
