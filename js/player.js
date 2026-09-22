// セーブ状態(state)を受け取って動くプレイヤー操作関数群
(function(global){
  "use strict";
  const GD = GameData;

  function level(state){ return GD.levelForExp(state.exp); }

  function effectiveStats(state){
    const base = GD.statsAtLevel(level(state));
    const s = Object.assign({}, base);
    ['weapon','armor','accessory'].forEach(slot=>{
      const id = state.equipment[slot];
      if(!id) return;
      const eq = GD.getEquip(id);
      if(!eq) return;
      ['hp','mp','atk','def','mag','spd','luk'].forEach(k=>{ if(eq[k]) s[k]=(s[k]||0)+eq[k]; });
    });
    return s;
  }
  function maxHp(state){ return effectiveStats(state).hp; }
  function maxMp(state){ return effectiveStats(state).mp; }
  function hasAllResist(state){
    return ['weapon','armor','accessory'].some(slot=>{
      const eq = GD.getEquip(state.equipment[slot]);
      return eq && eq.allResist;
    });
  }

  function clampVitals(state){
    state.hp = Math.max(0, Math.min(state.hp, maxHp(state)));
    state.mp = Math.max(0, Math.min(state.mp, maxMp(state)));
  }

  function gainExp(state, amount){
    const oldLevel = level(state);
    state.exp += amount;
    const newLevel = level(state);
    clampVitals(state);
    return {leveledUp:newLevel>oldLevel, oldLevel, newLevel};
  }

  function gainGold(state, amount){ state.gold = Math.max(0, state.gold+amount); }

  function inventoryFind(state, id){ return state.inventory.find(i=>i.id===id); }
  function addItem(state, id, qty){
    qty = qty||1;
    const ex = inventoryFind(state,id);
    if(ex) ex.qty += qty; else state.inventory.push({id, qty});
  }
  function removeItem(state, id, qty){
    qty = qty||1;
    const ex = inventoryFind(state,id);
    if(!ex) return false;
    ex.qty -= qty;
    if(ex.qty<=0) state.inventory = state.inventory.filter(i=>i.id!==id);
    return true;
  }
  function useItem(state, id){
    const item = GD.getItem(id);
    if(!item) return {ok:false};
    const ex = inventoryFind(state,id);
    if(!ex || ex.qty<=0) return {ok:false};
    let text = '';
    if(item.effect.type==='heal_hp'){
      const before = state.hp;
      state.hp = Math.min(maxHp(state), state.hp+item.effect.amount);
      text = (state.hp-before)+'かいふくした!';
    } else if(item.effect.type==='heal_mp'){
      const before = state.mp;
      state.mp = Math.min(maxMp(state), state.mp+item.effect.amount);
      text = 'MPが'+(state.mp-before)+'かいふくした!';
    } else if(item.effect.type==='full_heal'){
      state.hp = maxHp(state); state.mp = maxMp(state);
      text = 'HPとMPが全回復した!';
    }
    removeItem(state, id, 1);
    return {ok:true, text};
  }

  function equip(state, slot, equipId){
    if(equipId!==null && state.ownedEquipment.indexOf(equipId)===-1) return false;
    const eq = equipId ? GD.getEquip(equipId) : null;
    if(eq && eq.slot!==slot) return false;
    state.equipment[slot] = equipId;
    clampVitals(state);
    return true;
  }
  function acquireEquip(state, equipId){
    if(state.ownedEquipment.indexOf(equipId)===-1) state.ownedEquipment.push(equipId);
  }
  function sellEquip(state, equipId){
    const eq = GD.getEquip(equipId);
    if(!eq) return 0;
    const idx = state.ownedEquipment.indexOf(equipId);
    if(idx===-1) return 0;
    state.ownedEquipment.splice(idx,1);
    ['weapon','armor','accessory'].forEach(slot=>{ if(state.equipment[slot]===equipId) state.equipment[slot]=null; });
    gainGold(state, eq.sell);
    return eq.sell;
  }

  function knownSkills(state){ return GD.skillsKnownAtLevel(level(state)); }

  function addBestiary(state, monsterId){
    if(state.bestiary.indexOf(monsterId)===-1) state.bestiary.push(monsterId);
  }
  function bestiaryProgress(state){
    const total = Object.keys(GD.MONSTERS).length;
    return {seen: state.bestiary.length, total};
  }

  global.Player = {
    level, effectiveStats, maxHp, maxMp, hasAllResist, clampVitals,
    gainExp, gainGold, addItem, removeItem, useItem, inventoryFind,
    equip, acquireEquip, sellEquip, knownSkills, addBestiary, bestiaryProgress
  };
})(window);
