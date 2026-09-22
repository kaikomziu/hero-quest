// クリアタイム世界ランキング(Supabase)
(function(global){
  "use strict";
  const SUPABASE_URL = ''; // 後で設定
  const SUPABASE_ANON_KEY = ''; // 後で設定
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
