// localStorageへのセーブ/ロードと周回引き継ぎ情報の管理
(function(global){
  "use strict";
  const SAVE_KEY = 'heroQuest_save_v1';
  const META_KEY = 'heroQuest_meta_v1';

  function defaultFlags(){
    return {
      d1clear:false,d2clear:false,d3clear:false,d4clear:false,d5clear:false,postgame:false,hiddenClear:false,
      chest_d1:false,chest_d2:false,chest_d3:false,chest_d4:false,chest_d5:false,chest_hidden:false
    };
  }

  function newSaveState(name, gender, meta){
    meta = meta || loadMeta();
    const bonusLevel = meta.clearedOnce ? 3 : 0;
    const bonusGold = meta.clearedOnce ? 300 : 0;
    const startExp = bonusLevel>0 ? GameData.EXP_TABLE[1+bonusLevel] : 0;
    const stats = GameData.statsAtLevel(1+bonusLevel);
    return {
      version:1,
      name: name || 'ゆうしゃ',
      gender: gender || 'boy',
      exp: startExp,
      hp: stats.hp,
      mp: stats.mp,
      gold: 50 + bonusGold,
      equipment: {weapon:'w_starter', armor:'a_starter', accessory:null},
      ownedEquipment: ['w_starter','a_starter'],
      inventory: [{id:'herb', qty:3}],
      flags: defaultFlags(),
      bestiary: [],
      position: {map:'town1', x:5, y:4, dir:'down'},
      playtimeSec: 0,
      clearTimeSec: null,
      createdAt: Date.now()
    };
  }

  function save(state){
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    }catch(e){ return false; }
  }
  function load(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function hasSave(){ return !!localStorage.getItem(SAVE_KEY); }
  function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

  function loadMeta(){
    try{
      const raw = localStorage.getItem(META_KEY);
      if(!raw) return {clearedOnce:false, bestClearSec:null};
      return JSON.parse(raw);
    }catch(e){ return {clearedOnce:false, bestClearSec:null}; }
  }
  function saveMeta(meta){
    try{ localStorage.setItem(META_KEY, JSON.stringify(meta)); }catch(e){}
  }
  function markCleared(clearSec){
    const meta = loadMeta();
    meta.clearedOnce = true;
    if(meta.bestClearSec===null || clearSec < meta.bestClearSec) meta.bestClearSec = clearSec;
    saveMeta(meta);
  }

  global.SaveSystem = { newSaveState, save, load, hasSave, clearSave, loadMeta, saveMeta, markCleared };
})(window);
