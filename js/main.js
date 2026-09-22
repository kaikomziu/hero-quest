// ゲーム全体のステートマシン・入力処理・メインループ
(function(){
  "use strict";
  const GD = GameData;
  const PX = PixelArt;
  const LOGICAL_W = 240, LOGICAL_H = 384;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = LOGICAL_W; canvas.height = LOGICAL_H;
  ctx.imageSmoothingEnabled = false;
  const overlayRoot = document.getElementById('overlayRoot');

  // ===== 入力 =====
  const Input = {
    held: {up:false,down:false,left:false,right:false,ok:false,cancel:false},
    tapQueue: [],
    update(){ if(this.tapQueue.length>20) this.tapQueue.length=0; },
    justPressed(k){ const idx=this.tapQueue.indexOf(k); if(idx>=0){ this.tapQueue.splice(idx,1); return true; } return false; },
    isDown(k){ return !!this.held[k]; }
  };
  const KEY_MAP = {ArrowUp:'up','w':'up','W':'up',ArrowDown:'down','s':'down','S':'down',
    ArrowLeft:'left','a':'left','A':'left',ArrowRight:'right','d':'right','D':'right',
    'z':'ok','Z':'ok','Enter':'ok',' ':'ok','x':'cancel','X':'cancel',Escape:'cancel'};
  window.addEventListener('keydown', (e)=>{ const k=KEY_MAP[e.key]; if(k){ if(!Input.held[k]) Input.tapQueue.push(k); Input.held[k]=true; e.preventDefault(); } });
  window.addEventListener('keyup', (e)=>{ const k=KEY_MAP[e.key]; if(k){ Input.held[k]=false; e.preventDefault(); } });

  function wireTouchButton(el, key){
    const down = (e)=>{ e.preventDefault(); if(!Input.held[key]) Input.tapQueue.push(key); Input.held[key]=true; ensureAudio(); };
    const up = (e)=>{ e.preventDefault(); Input.held[key]=false; };
    el.addEventListener('touchstart', down, {passive:false});
    el.addEventListener('touchend', up, {passive:false});
    el.addEventListener('touchcancel', up, {passive:false});
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }
  wireTouchButton(document.getElementById('btnUp'),'up');
  wireTouchButton(document.getElementById('btnDown'),'down');
  wireTouchButton(document.getElementById('btnLeft'),'left');
  wireTouchButton(document.getElementById('btnRight'),'right');
  wireTouchButton(document.getElementById('btnOk'),'ok');
  wireTouchButton(document.getElementById('btnCancel'),'cancel');

  let audioReady = false;
  function ensureAudio(){ if(!audioReady){ GameAudio.init(); audioReady = true; } }
  window.addEventListener('pointerdown', ensureAudio, {once:true});

  // ===== ゲーム全体状態 =====
  const Game = {
    mode: 'title',
    state: null,
    world: null,
    battle: null,
    titleMenu: null,
    titleScroll: 0,
    worldDialogue: null,
    worldDialogueName: null,
    worldDialogueAfter: null,
    pendingBattle: {flag:null, id:null},
    pauseMenu: null,
    shop: null,
    inn: null,
    ending: null,
    ranking: {menu:null, rows:[], loading:false},
    genderSel: 'boy',
    confirmBox: null // {text, onYes, onNo, menu}
  };

  function currentBgm(){
    if(Game.mode==='battle'){
      const boss = Game.battle && Game.battle.enemies.some(e=>e.isBoss);
      return boss ? 'boss' : 'battle';
    }
    if(Game.mode==='title') return 'title';
    if(Game.mode==='field' && Game.world){
      return Game.world.current.bgMusic;
    }
    return null;
  }
  let lastBgm = null;
  function syncBgm(){
    const t = currentBgm();
    if(t && t!==lastBgm){ GameAudio.playBGM(t); lastBgm = t; }
    if(!t && lastBgm){ /* keep last track during overlays like dialogue/shop over field */ }
  }

  function autosave(){
    if(!Game.state) return;
    if(Game.world) Game.world.savePosition();
    SaveSystem.save(Game.state);
  }

  // ===== タイトル =====
  function enterTitle(){
    Game.mode = 'title';
    const opts = [{label:'はじめから', cmd:'new'}];
    if(SaveSystem.hasSave()) opts.push({label:'つづきから', cmd:'continue'});
    opts.push({label:'せかいランキング', cmd:'ranking'});
    Game.titleMenu = new UI.Menu(opts, {cols:1});
  }
  function updateTitle(dt){
    Game.titleScroll += dt*14;
    if(Game.confirmBox){ updateConfirmBox(); return; }
    if(Input.justPressed('up')) Game.titleMenu.move('up');
    if(Input.justPressed('down')) Game.titleMenu.move('down');
    if(Input.justPressed('ok')){
      const sel = Game.titleMenu.selected();
      GameAudio.sfx.confirm();
      if(sel.cmd==='new'){
        if(SaveSystem.hasSave()){
          openConfirm('セーブデータがあります。\nあたらしく はじめますか?', ()=>{ startNewGameFlow(); }, ()=>{});
        } else {
          startNewGameFlow();
        }
      } else if(sel.cmd==='continue'){
        const s = SaveSystem.load();
        if(s){ Game.state = s; beginFieldFromState(); }
      } else if(sel.cmd==='ranking'){
        enterRanking();
      }
    }
  }
  function drawTitleBg(){
    const TILE=24;
    const off = Math.floor(Game.titleScroll)%TILE;
    for(let y=-1;y<=LOGICAL_H/TILE+1;y++){
      for(let x=-1;x<=LOGICAL_W/TILE+1;x++){
        PX.drawSprite(ctx, PX.tiles.grass, x*TILE-off, y*TILE, TILE);
      }
    }
    [[2,3],[6,7],[10,2],[3,9],[8,10]].forEach(([gx,gy])=>{
      PX.drawSprite(ctx, PX.tiles.tree, gx*TILE-off, gy*TILE, TILE);
    });
  }
  function drawTitle(){
    drawTitleBg();
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,30,0.45)';
    ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f4f8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('ゆうしゃ、', LOGICAL_W/2, 70);
    ctx.fillText('はじめました。', LOGICAL_W/2, 96);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = UI.COL.dim;
    ctx.fillText('- HERO QUEST -', LOGICAL_W/2, 116);
    ctx.restore();
    UI.drawMenu(ctx, 30, 170, LOGICAL_W-60, Game.titleMenu.items.length*24+22, Game.titleMenu, {rowH:24});
    if(Game.confirmBox) drawConfirmBox();
  }

  function openConfirm(text, onYes, onNo){
    const menu = new UI.Menu([{label:'はい', v:true},{label:'いいえ', v:false}], {cols:2});
    Game.confirmBox = {dialogue:new UI.Dialogue([text],{speed:60}), menu, onYes, onNo, waitingChoice:false};
  }
  function updateConfirmBox(){
    const cb = Game.confirmBox;
    if(cb.dialogue) cb.dialogue.update(1/60);
    if(!cb.waitingChoice){
      if(Input.justPressed('ok')){
        if(cb.dialogue.confirm()){ cb.waitingChoice = true; }
      }
      return;
    }
    if(Input.justPressed('left') || Input.justPressed('right')) cb.menu.move('left');
    if(Input.justPressed('ok')){
      GameAudio.sfx.confirm();
      const yes = cb.menu.selected().v;
      Game.confirmBox = null;
      if(yes && cb.onYes) cb.onYes();
      if(!yes && cb.onNo) cb.onNo();
    }
  }
  function drawConfirmBox(){
    const cb = Game.confirmBox;
    const w=LOGICAL_W-30, h=90, x=15, y=LOGICAL_H/2-45;
    UI.drawWindow(ctx,x,y,w,h,{accent:true});
    ctx.save();
    ctx.fillStyle = UI.COL.text;
    ctx.font='13px sans-serif';
    ctx.textBaseline='top';
    const shown = cb.dialogue.currentText().slice(0, cb.dialogue.revealChars);
    UI.wrapByWidth(ctx, shown, w-24, '13px sans-serif').forEach((line,i)=>ctx.fillText(line, x+14, y+14+i*18));
    ctx.restore();
    if(cb.waitingChoice){
      UI.drawMenu(ctx, x+w/2-70, y+h-34, 140, 30, cb.menu, {rowH:20});
    }
  }

  // ===== 名前・性別選択(HTML overlay) =====
  function enterNameGender(){
    Game.mode = 'namegender';
    overlayRoot.innerHTML = '';
    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:8%;right:8%;top:30%;background:linear-gradient(#232c56,#131936);border:2px solid #f0f4ff;padding:16px;color:#f4f4f8;font-family:sans-serif;border-radius:4px;';
    panel.innerHTML = `
      <div style="font-size:13px;margin-bottom:8px;">なまえをいれてください</div>
      <input id="nameInput" maxlength="8" placeholder="ゆうしゃ" style="width:100%;box-sizing:border-box;font-size:16px;padding:6px;border-radius:4px;border:1px solid #4a5aa8;background:#0d1330;color:#fff;margin-bottom:14px;">
      <div style="font-size:13px;margin-bottom:8px;">せいべつをえらんでください</div>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button id="genderBoy" style="flex:1;padding:10px;border-radius:4px;border:2px solid #3f6fd6;background:#2a4a9c;color:#fff;font-size:13px;">男の子</button>
        <button id="genderGirl" style="flex:1;padding:10px;border-radius:4px;border:2px solid #d6488f;background:#8a2a5c;color:#fff;font-size:13px;">女の子</button>
      </div>
      <button id="startBtn" style="width:100%;padding:12px;border-radius:4px;border:2px solid #ffce54;background:#8a6a1a;color:#fff;font-size:14px;font-weight:bold;">この なまえで はじめる</button>
    `;
    overlayRoot.appendChild(panel);
    let gender = 'boy';
    const boyBtn = panel.querySelector('#genderBoy');
    const girlBtn = panel.querySelector('#genderGirl');
    function refreshGenderBtns(){
      boyBtn.style.opacity = gender==='boy' ? '1' : '0.5';
      girlBtn.style.opacity = gender==='girl' ? '1' : '0.5';
    }
    refreshGenderBtns();
    boyBtn.onclick = ()=>{ gender='boy'; refreshGenderBtns(); };
    girlBtn.onclick = ()=>{ gender='girl'; refreshGenderBtns(); };
    panel.querySelector('#startBtn').onclick = ()=>{
      ensureAudio();
      const nameVal = panel.querySelector('#nameInput').value.trim() || 'ゆうしゃ';
      overlayRoot.innerHTML = '';
      const meta = SaveSystem.loadMeta();
      Game.state = SaveSystem.newSaveState(nameVal, gender, meta);
      SaveSystem.save(Game.state);
      enterIntro();
    };
  }
  function startNewGameFlow(){ enterNameGender(); }

  // ===== オープニング =====
  function enterIntro(){
    Game.mode = 'introStory';
    Game.worldDialogue = new UI.Dialogue(GD.STORY.intro.slice(), {speed:34});
  }
  function updateIntro(dt){
    Game.worldDialogue.update(dt);
    if(Input.justPressed('ok')){
      if(Game.worldDialogue.confirm()){ beginFieldFromState(); }
    }
  }
  function drawIntro(){
    ctx.fillStyle = '#0a0e1e';
    ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
    UI.drawDialogueBox(ctx, LOGICAL_W, LOGICAL_H, Game.worldDialogue, null);
  }

  // ===== フィールド =====
  function worldCallbacks(){
    return {
      onMapEnter(){ autosave(); syncBgm(); },
      onDialogue(lines, name, after){ Game.worldDialogue = new UI.Dialogue(lines, {speed:38}); Game.worldDialogueName=name; Game.worldDialogueAfter=after; },
      onShopOpen(shopId){ openShop(shopId); },
      onInnOpen(npc){ openInn(); },
      onBattleStart(enemyIds, isBoss, flag, bossId){
        Game.pendingBattle = {flag, id:bossId};
        Game.world.savePosition();
        SaveSystem.save(Game.state);
        Game.battle = new Battle(Game.state, enemyIds, {onEnd:onBattleEnd});
        Game.mode = 'battle';
        lastBgm = null;
      }
    };
  }
  function beginFieldFromState(){
    Game.worldDialogue = null; Game.worldDialogueName = null; Game.worldDialogueAfter = null;
    Game.world = new World(Game.state, worldCallbacks());
    Game.mode = 'field';
    lastBgm = null;
  }

  function updateField(dt){
    if(Game.worldDialogue){
      Game.worldDialogue.update(dt);
      if(Input.justPressed('ok')){
        const done = Game.worldDialogue.confirm();
        if(done){
          const after = Game.worldDialogueAfter;
          Game.worldDialogue = null; Game.worldDialogueName=null; Game.worldDialogueAfter=null;
          if(after) after();
        }
      }
      return;
    }
    Game.world.update(dt);
    if(Input.isDown('up')) Game.world.tryMove('up');
    else if(Input.isDown('down')) Game.world.tryMove('down');
    else if(Input.isDown('left')) Game.world.tryMove('left');
    else if(Input.isDown('right')) Game.world.tryMove('right');
    if(Input.justPressed('ok')) openPauseMenu();
  }
  function drawField(){
    Game.world.draw(ctx, LOGICAL_W, LOGICAL_H);
    if(Game.worldDialogue){
      UI.drawDialogueBox(ctx, LOGICAL_W, LOGICAL_H, Game.worldDialogue, Game.worldDialogueName);
    }
  }

  // ===== 戦闘 =====
  function onBattleEnd(result){
    if(result.result==='victory'){
      if(Game.pendingBattle.flag){
        Game.state.flags[Game.pendingBattle.flag] = true;
      }
      const bossId = Game.pendingBattle.id;
      Game.battle = null;
      if(bossId==='boss_maou'){
        beginEnding();
        return;
      }
      if(bossId==='boss_ancientdragon'){
        Game.mode='field'; lastBgm=null;
        Game.worldDialogue = new UI.Dialogue(['古竜の力を打ち破った…!','まだ見ぬ強さを、手に入れたようだ。'], {speed:38});
        autosave();
        return;
      }
      Game.mode = 'field'; lastBgm = null;
      autosave();
    } else if(result.result==='escape'){
      Game.battle = null;
      Game.mode = 'field'; lastBgm = null;
    } else if(result.result==='defeat'){
      Game.battle = null;
      const s = SaveSystem.load();
      if(s){ Game.state = s; beginFieldFromState();
        Game.worldDialogue = new UI.Dialogue(['ちからつきたが…なんとか意識を取り戻した。','ぼうけんを つづけよう。'], {speed:38});
      } else {
        enterTitle();
      }
    }
  }
  function updateBattle(dt){
    Game.battle.update(dt);
    if(Input.justPressed('up')) Game.battle.move('up');
    if(Input.justPressed('down')) Game.battle.move('down');
    if(Input.justPressed('left')) Game.battle.move('left');
    if(Input.justPressed('right')) Game.battle.move('right');
    if(Input.justPressed('ok')) Game.battle.confirm();
    if(Input.justPressed('cancel')) Game.battle.cancel();
  }
  function drawBattle(){ Game.battle.draw(ctx, LOGICAL_W, LOGICAL_H); }

  // ===== ポーズメニュー =====
  function openPauseMenu(){
    Game.mode = 'pauseMenu';
    Game.pauseMenu = {screen:'main', menu: buildPauseMainMenu(), sub:null, msg:null};
    GameAudio.sfx.open();
  }
  function buildPauseMainMenu(){
    return new UI.Menu([
      {label:'ステータス', s:'status'},
      {label:'そうび', s:'equip'},
      {label:'どうぐ', s:'items'},
      {label:'とくぎ', s:'skills'},
      {label:'モンスターずかん', s:'bestiary'},
      {label:'セーブする', s:'save'},
      {label:'タイトルへ もどる', s:'title'},
      {label:'とじる', s:'close'}
    ], {cols:1});
  }
  function updatePauseMenu(dt){
    const pm = Game.pauseMenu;
    if(pm.msg){ pm.msg.update(dt); if(Input.justPressed('ok')){ if(pm.msg.confirm()) pm.msg=null; } return; }
    if(Game.confirmBox){ updateConfirmBox(); return; }
    if(pm.screen==='main'){
      if(Input.justPressed('up')) pm.menu.move('up');
      if(Input.justPressed('down')) pm.menu.move('down');
      if(Input.justPressed('cancel')){ Game.mode='field'; GameAudio.sfx.cancel(); return; }
      if(Input.justPressed('ok')){
        const sel = pm.menu.selected();
        GameAudio.sfx.confirm();
        if(sel.s==='close'){ Game.mode='field'; }
        else if(sel.s==='title'){
          openConfirm('タイトルへ もどりますか?', ()=>{ autosave(); enterTitle(); }, ()=>{});
        } else if(sel.s==='save'){
          autosave();
          pm.msg = new UI.Dialogue(['セーブしました。'], {speed:60});
        } else if(sel.s==='equip'){
          pm.screen='equip'; pm.equipSlotIdx=0; pm.equipMenu=buildEquipSlotMenu();
        } else if(sel.s==='items'){
          pm.screen='items'; pm.itemsMenu=buildItemsMenu();
        } else if(sel.s==='skills'){
          pm.screen='skills';
        } else if(sel.s==='bestiary'){
          pm.screen='bestiary';
        } else if(sel.s==='status'){
          pm.screen='status';
        }
      }
      return;
    }
    if(pm.screen==='status' || pm.screen==='skills'){
      if(Input.justPressed('cancel') || Input.justPressed('ok')){ pm.screen='main'; GameAudio.sfx.cancel(); }
      return;
    }
    if(pm.screen==='bestiary'){
      if(Input.justPressed('cancel') || Input.justPressed('ok')){ pm.screen='main'; GameAudio.sfx.cancel(); return; }
      if(Input.justPressed('down')) pm.bestiaryScroll = (pm.bestiaryScroll||0)+1;
      if(Input.justPressed('up')) pm.bestiaryScroll = Math.max(0,(pm.bestiaryScroll||0)-1);
      return;
    }
    if(pm.screen==='equip'){
      if(Input.justPressed('cancel')){ pm.screen='main'; GameAudio.sfx.cancel(); return; }
      if(Input.justPressed('up')) pm.equipMenu.move('up');
      if(Input.justPressed('down')) pm.equipMenu.move('down');
      if(Input.justPressed('ok')){
        GameAudio.sfx.confirm();
        const slot = pm.equipMenu.selected().slot;
        pm.screen='equipPick'; pm.equipPickMenu=buildEquipPickMenu(slot); pm.pickSlot=slot;
      }
      return;
    }
    if(pm.screen==='equipPick'){
      if(Input.justPressed('cancel')){ pm.screen='equip'; GameAudio.sfx.cancel(); return; }
      if(Input.justPressed('up')) pm.equipPickMenu.move('up');
      if(Input.justPressed('down')) pm.equipPickMenu.move('down');
      if(Input.justPressed('ok')){
        const sel = pm.equipPickMenu.selected();
        GameAudio.sfx.confirm();
        Player.equip(Game.state, pm.pickSlot, sel.equipId);
        pm.screen='equip'; pm.equipMenu=buildEquipSlotMenu();
      }
      return;
    }
    if(pm.screen==='items'){
      if(Input.justPressed('cancel')){ pm.screen='main'; GameAudio.sfx.cancel(); return; }
      if(Input.justPressed('up')) pm.itemsMenu.move('up');
      if(Input.justPressed('down')) pm.itemsMenu.move('down');
      if(Input.justPressed('ok')){
        const sel = pm.itemsMenu.selected();
        if(sel.back){ pm.screen='main'; return; }
        GameAudio.sfx.confirm();
        const res = Player.useItem(Game.state, sel.itemId);
        if(res.ok){ pm.msg = new UI.Dialogue([res.text],{speed:60}); pm.itemsMenu = buildItemsMenu(); }
      }
      return;
    }
  }
  function buildEquipSlotMenu(){
    const slots = ['weapon','armor','accessory'];
    const label = {weapon:'ぶき', armor:'よろい', accessory:'アクセサリ'};
    return new UI.Menu(slots.map(slot=>{
      const id = Game.state.equipment[slot];
      const eq = id ? GD.getEquip(id) : null;
      return {label:label[slot], rightLabel: eq?eq.name:'(なし)', slot};
    }), {cols:1});
  }
  function buildEquipPickMenu(slot){
    const owned = Game.state.ownedEquipment.filter(id=>GD.getEquip(id).slot===slot);
    const items = owned.map(id=>{ const eq=GD.getEquip(id); return {label:eq.name, rightLabel: (eq.atk?('攻'+eq.atk+' '):'')+(eq.def?('防'+eq.def+' '):'')+(eq.mag?('魔'+eq.mag+' '):'')+(eq.spd?('速'+eq.spd+' '):''), equipId:id}; });
    items.push({label:'はずす', equipId:null});
    return new UI.Menu(items, {cols:1});
  }
  function buildItemsMenu(){
    const items = Game.state.inventory.filter(i=>i.qty>0).map(i=>{ const def=GD.getItem(i.id); return {label:def.name, rightLabel:'x'+i.qty, itemId:i.id}; });
    items.push({label:'もどる', back:true});
    return new UI.Menu(items, {cols:1});
  }

  function drawPauseMenu(){
    Game.world.draw(ctx, LOGICAL_W, LOGICAL_H);
    ctx.save(); ctx.fillStyle='rgba(6,8,20,0.55)'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H); ctx.restore();
    const pm = Game.pauseMenu;
    if(pm.screen==='main'){
      UI.drawMenu(ctx, 20, 30, LOGICAL_W-40, pm.menu.items.length*24+22, pm.menu, {rowH:24});
    } else if(pm.screen==='status'){
      drawStatusPanel();
    } else if(pm.screen==='equip'){
      UI.drawMenu(ctx, 20, 30, LOGICAL_W-40, pm.equipMenu.items.length*24+22, pm.equipMenu, {rowH:24});
    } else if(pm.screen==='equipPick'){
      UI.drawMenu(ctx, 20, 30, LOGICAL_W-40, pm.equipPickMenu.items.length*22+22, pm.equipPickMenu, {rowH:22});
    } else if(pm.screen==='items'){
      UI.drawMenu(ctx, 20, 30, LOGICAL_W-40, pm.itemsMenu.items.length*22+22, pm.itemsMenu, {rowH:22});
    } else if(pm.screen==='skills'){
      drawSkillsPanel();
    } else if(pm.screen==='bestiary'){
      drawBestiaryPanel();
    }
    if(pm.msg){
      UI.drawDialogueBox(ctx, LOGICAL_W, LOGICAL_H, pm.msg, null);
    }
    if(Game.confirmBox) drawConfirmBox();
  }
  function drawStatusPanel(){
    const s = Game.state;
    const stats = Player.effectiveStats(s);
    const w=LOGICAL_W-40,h=220,x=20,y=40;
    UI.drawWindow(ctx,x,y,w,h,{accent:true});
    ctx.save(); ctx.fillStyle=UI.COL.text; ctx.font='13px sans-serif'; ctx.textBaseline='top';
    const lv = Player.level(s);
    const next = GD.expToNextLevel(s.exp);
    const lines = [
      s.name+'  Lv.'+lv,
      'HP '+s.hp+'/'+stats.hp,
      'MP '+s.mp+'/'+stats.mp,
      'つぎのレベルまで '+(next===null?'MAX':next),
      '',
      'こうげき力 '+stats.atk,
      'ぼうぎょ力 '+stats.def,
      'まほう力 '+stats.mag,
      'すばやさ '+stats.spd,
      'うん '+stats.luk,
      '',
      'ゴールド '+s.gold+'G'
    ];
    lines.forEach((l,i)=>ctx.fillText(l, x+16, y+14+i*17));
    ctx.restore();
    ctx.save(); ctx.fillStyle=UI.COL.dim; ctx.font='11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('✕ボタンで もどる', LOGICAL_W/2, y+h-16);
    ctx.restore();
  }
  function drawSkillsPanel(){
    const skills = Player.knownSkills(Game.state);
    const safeBottom = LOGICAL_H - UI.CONTROL_RESERVE;
    const x=20, y=30, w=LOGICAL_W-40, h=safeBottom-y;
    const rowH = 30;
    UI.drawWindow(ctx,x,y,w,h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x,y,w,h-18); ctx.clip();
    ctx.fillStyle=UI.COL.text; ctx.font='12px sans-serif'; ctx.textBaseline='top';
    skills.forEach((s,i)=>{
      ctx.fillStyle = UI.COL.accent;
      ctx.fillText(s.name+' (MP'+s.mp+')', x+14, y+12+i*rowH);
      ctx.fillStyle = UI.COL.text;
      ctx.font='11px sans-serif';
      ctx.fillText(s.desc, x+14, y+27+i*rowH);
      ctx.font='12px sans-serif';
    });
    ctx.restore();
    ctx.save(); ctx.fillStyle=UI.COL.dim; ctx.font='11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('✕/◯ボタンで もどる', LOGICAL_W/2, y+h-14);
    ctx.restore();
  }
  function drawBestiaryPanel(){
    const prog = Player.bestiaryProgress(Game.state);
    const safeBottom = LOGICAL_H - UI.CONTROL_RESERVE;
    const x=20, y=30, w=LOGICAL_W-40, h=safeBottom-y;
    UI.drawWindow(ctx,x,y,w,h,{accent:true});
    ctx.save(); ctx.fillStyle=UI.COL.text; ctx.font='13px sans-serif'; ctx.textBaseline='top';
    ctx.fillText('モンスターずかん '+prog.seen+'/'+prog.total, x+14, y+12);
    ctx.restore();
    const listTop = y+34, listBottom = y+h-18;
    const rowH = 15;
    const maxRows = Math.floor((listBottom-listTop)/rowH);
    const monsters = Object.values(GD.MONSTERS);
    const maxScroll = Math.max(0, monsters.length-maxRows);
    Game.pauseMenu.bestiaryScroll = Math.min(Math.max(0, Game.pauseMenu.bestiaryScroll||0), maxScroll);
    const scroll = Game.pauseMenu.bestiaryScroll;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, listTop-12, w, listBottom-listTop+12); ctx.clip();
    ctx.font='11px sans-serif'; ctx.textBaseline='top';
    for(let i=0;i<maxRows && scroll+i<monsters.length;i++){
      const m = monsters[scroll+i];
      const known = Game.state.bestiary.indexOf(m.id)>=0;
      ctx.fillStyle = known ? UI.COL.text : UI.COL.dim;
      ctx.fillText(known ? m.name : '？？？？？', x+14, listTop+i*rowH);
    }
    ctx.restore();
    if(maxScroll>0){
      ctx.save(); ctx.fillStyle=UI.COL.dim; ctx.textAlign='center'; ctx.font='11px sans-serif';
      if(scroll>0) ctx.fillText('▲', x+w-16, listTop-12);
      if(scroll<maxScroll) ctx.fillText('▼', x+w-16, listBottom-12);
      ctx.restore();
    }
    ctx.save(); ctx.fillStyle=UI.COL.dim; ctx.font='11px sans-serif'; ctx.textAlign='center';
    ctx.fillText('✕ボタンで もどる', LOGICAL_W/2, y+h-14);
    ctx.restore();
  }

  // ===== ショップ =====
  function openShop(shopId){
    Game.mode = 'shop';
    Game.shop = {shopId, tab:'buy', menu:null, msg:null};
    Game.shop.menu = buildShopMenu();
  }
  function buildShopMenu(){
    const shop = GD.SHOPS[Game.shop.shopId];
    const s = Game.state;
    if(Game.shop.tab==='buy'){
      const rows = shop.items.map(id=>{ const it=GD.getItem(id); return {label:it.name, rightLabel:it.price+'G', buy:'item', id, price:it.price, disabled:s.gold<it.price}; })
        .concat(shop.equip.map(id=>{ const eq=GD.getEquip(id); const owned=s.ownedEquipment.indexOf(id)>=0; return {label:eq.name, rightLabel: owned?'所持ずみ':eq.price+'G', buy:'equip', id, price:eq.price, disabled: owned || s.gold<eq.price}; }));
      rows.push({label:'▶ うる にきりかえ', switchTab:true});
      rows.push({label:'店を出る', exit:true});
      return new UI.Menu(rows, {cols:1});
    } else {
      const rows = s.inventory.filter(i=>i.qty>0).map(i=>{ const it=GD.getItem(i.id); return {label:it.name, rightLabel:it.sell+'G', sell:'item', id:i.id}; })
        .concat(s.ownedEquipment.map(id=>{ const eq=GD.getEquip(id); return {label:eq.name, rightLabel:eq.sell+'G', sell:'equip', id}; }));
      rows.push({label:'▶ かう にきりかえ', switchTab:true});
      rows.push({label:'店を出る', exit:true});
      return new UI.Menu(rows, {cols:1});
    }
  }
  function updateShop(dt){
    const sh = Game.shop;
    if(sh.msg){ sh.msg.update(dt); if(Input.justPressed('ok')){ if(sh.msg.confirm()) sh.msg=null; } return; }
    if(Input.justPressed('cancel')){ Game.mode='field'; GameAudio.sfx.cancel(); return; }
    if(Input.justPressed('up')) sh.menu.move('up');
    if(Input.justPressed('down')) sh.menu.move('down');
    if(Input.justPressed('ok')){
      const sel = sh.menu.selected();
      if(sel.exit){ Game.mode='field'; GameAudio.sfx.cancel(); return; }
      if(sel.switchTab){ sh.tab = sh.tab==='buy'?'sell':'buy'; sh.menu=buildShopMenu(); GameAudio.sfx.cursor(); return; }
      if(sel.buy){
        if(sel.disabled) return;
        Game.state.gold -= sel.price;
        if(sel.buy==='item') Player.addItem(Game.state, sel.id, 1); else Player.acquireEquip(Game.state, sel.id);
        GameAudio.sfx.buy();
        sh.menu = buildShopMenu();
      } else if(sel.sell){
        if(sel.sell==='item'){ const it=GD.getItem(sel.id); Player.removeItem(Game.state, sel.id, 1); Player.gainGold(Game.state, it.sell); }
        else { Player.sellEquip(Game.state, sel.id); }
        GameAudio.sfx.buy();
        sh.menu = buildShopMenu();
      }
    }
  }
  function drawShop(){
    Game.world.draw(ctx, LOGICAL_W, LOGICAL_H);
    ctx.save(); ctx.fillStyle='rgba(6,8,20,0.6)'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H); ctx.restore();
    ctx.save(); ctx.fillStyle=UI.COL.text; ctx.font='12px sans-serif'; ctx.textAlign='left';
    ctx.fillText('しょとくGold: '+Game.state.gold+'G', 24, 18);
    ctx.restore();
    const sh = Game.shop;
    const shopTop = 34;
    const h = Math.min(LOGICAL_H-UI.CONTROL_RESERVE-shopTop, sh.menu.items.length*22+24);
    UI.drawMenu(ctx, 16, shopTop, LOGICAL_W-32, h, sh.menu, {rowH:22});
    if(sh.msg) UI.drawDialogueBox(ctx, LOGICAL_W, LOGICAL_H, sh.msg, null);
  }

  // ===== 宿屋 =====
  function openInn(){
    Game.mode = 'inn';
    const cost = 10 + Player.level(Game.state)*4;
    Game.inn = {cost, dialogue:new UI.Dialogue(['やすんでいきますか? ('+cost+'G)'],{speed:60}), menu:new UI.Menu([{label:'はい',v:true},{label:'いいえ',v:false}],{cols:2}), choosing:false};
  }
  function updateInn(dt){
    const inn = Game.inn;
    inn.dialogue.update(dt);
    if(!inn.choosing){
      if(Input.justPressed('ok')){ if(inn.dialogue.confirm()) inn.choosing=true; }
      return;
    }
    if(Input.justPressed('left')||Input.justPressed('right')) inn.menu.move('left');
    if(Input.justPressed('ok')){
      const yes = inn.menu.selected().v;
      GameAudio.sfx.confirm();
      if(yes){
        if(Game.state.gold>=inn.cost){
          Game.state.gold -= inn.cost;
          Game.state.hp = Player.maxHp(Game.state);
          Game.state.mp = Player.maxMp(Game.state);
          GameAudio.sfx.heal();
          inn.dialogue = new UI.Dialogue(['ぐっすり眠った!元気を取り戻した!'],{speed:50});
          inn.choosing='result';
          autosave();
        } else {
          inn.dialogue = new UI.Dialogue(['お金が足りないようだ…。'],{speed:50});
          inn.choosing='result';
        }
      } else {
        Game.mode='field';
      }
    } else if(inn.choosing==='result' && Input.justPressed('ok')){
      if(inn.dialogue.confirm()) Game.mode='field';
    }
  }
  function drawInn(){
    Game.world.draw(ctx, LOGICAL_W, LOGICAL_H);
    ctx.save(); ctx.fillStyle='rgba(6,8,20,0.55)'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H); ctx.restore();
    UI.drawDialogueBox(ctx, LOGICAL_W, LOGICAL_H, Game.inn.dialogue, '宿屋');
    if(Game.inn.choosing===true){
      UI.drawMenu(ctx, LOGICAL_W/2-70, LOGICAL_H-150, 140, 30, Game.inn.menu, {rowH:20});
    }
  }

  // ===== エンディング =====
  function beginEnding(){
    Game.mode = 'ending';
    Game.state.playtimeSec = Game.state.playtimeSec || 0;
    Game.state.clearTimeSec = Game.state.playtimeSec;
    Game.state.flags.postgame = true;
    SaveSystem.markCleared(Game.state.clearTimeSec);
    autosave();
    if(Ranking.isConfigured()) Ranking.submitScore(Game.state.name, Game.state.clearTimeSec, Player.level(Game.state));
    const extra = GD.STORY.bossVictoryExtra.boss_maou || [];
    Game.ending = {dialogue:new UI.Dialogue(extra.concat(GD.STORY.ending), {speed:34}), menu:null, finished:false};
    lastBgm = null;
  }
  function updateEnding(dt){
    const en = Game.ending;
    if(!en.finished){
      en.dialogue.update(dt);
      if(Input.justPressed('ok')){ if(en.dialogue.confirm()){ en.finished=true; en.menu = new UI.Menu([{label:'ぼうけんを つづける', v:'continue'},{label:'タイトルへ もどる', v:'title'}],{cols:1}); } }
      return;
    }
    if(Input.justPressed('up')) en.menu.move('up');
    if(Input.justPressed('down')) en.menu.move('down');
    if(Input.justPressed('ok')){
      const v = en.menu.selected().v;
      GameAudio.sfx.confirm();
      if(v==='continue'){ beginFieldFromState(); }
      else { enterTitle(); }
    }
  }
  function drawEnding(){
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
    const en = Game.ending;
    if(!en.finished){
      UI.drawDialogueBox(ctx, LOGICAL_W, LOGICAL_H, en.dialogue, null);
    } else {
      UI.drawMenu(ctx, 30, LOGICAL_H/2-40, LOGICAL_W-60, 70, en.menu, {rowH:24});
    }
  }

  // ===== ランキング =====
  function enterRanking(){
    Game.mode = 'ranking';
    Game.ranking = {rows:[], loading:true};
    Ranking.fetchTop(15).then(res=>{ Game.ranking.rows = res.rows||[]; Game.ranking.loading=false; });
  }
  function updateRanking(dt){
    if(Input.justPressed('cancel') || Input.justPressed('ok')){ enterTitle(); }
  }
  function drawRanking(){
    drawTitleBg();
    ctx.save(); ctx.fillStyle='rgba(6,8,20,0.7)'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H); ctx.restore();
    const w=LOGICAL_W-30,h=300,x=15,y=30;
    UI.drawWindow(ctx,x,y,w,h,{accent:true});
    ctx.save(); ctx.fillStyle=UI.COL.accent; ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
    ctx.fillText('せかい クリアタイム ランキング', LOGICAL_W/2, y+14);
    ctx.font='11px sans-serif'; ctx.fillStyle=UI.COL.text; ctx.textAlign='left';
    if(!Ranking.isConfigured()){
      ctx.fillText('(準備中です)', x+16, y+50);
    } else if(Game.ranking.loading){
      ctx.fillText('よみこみちゅう…', x+16, y+50);
    } else if(Game.ranking.rows.length===0){
      ctx.fillText('まだ記録がありません。', x+16, y+50);
    } else {
      Game.ranking.rows.forEach((r,i)=>{
        const mm = Math.floor(r.clear_seconds/60), ss = r.clear_seconds%60;
        ctx.fillText((i+1)+'. '+r.player_name+'  '+mm+'分'+ss+'秒  Lv'+r.level, x+16, y+40+i*17);
      });
    }
    ctx.fillStyle=UI.COL.dim;
    ctx.textAlign='center';
    ctx.fillText('✕/◯ボタンで もどる', LOGICAL_W/2, y+h-14);
    ctx.restore();
  }

  // ===== メインループ =====
  let lastT = performance.now();
  let lastMode = null;
  function loop(now){
    const dt = Math.min(0.05, (now-lastT)/1000);
    lastT = now;
    Input.update();
    if(Game.mode !== lastMode){ Input.tapQueue.length = 0; lastMode = Game.mode; }

    if(Game.state && (Game.mode==='field'||Game.mode==='battle'||Game.mode==='pauseMenu'||Game.mode==='shop'||Game.mode==='inn')){
      Game.state.playtimeSec = (Game.state.playtimeSec||0) + dt;
    }

    switch(Game.mode){
      case 'title': updateTitle(dt); break;
      case 'namegender': break;
      case 'introStory': updateIntro(dt); break;
      case 'field': updateField(dt); syncBgm(); break;
      case 'battle': updateBattle(dt); syncBgm(); break;
      case 'pauseMenu': updatePauseMenu(dt); break;
      case 'shop': updateShop(dt); break;
      case 'inn': updateInn(dt); break;
      case 'ending': updateEnding(dt); break;
      case 'ranking': updateRanking(dt); break;
    }

    switch(Game.mode){
      case 'title': drawTitle(); break;
      case 'namegender':
        ctx.fillStyle='#0a0e1e'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
        break;
      case 'introStory': drawIntro(); break;
      case 'field': drawField(); break;
      case 'battle': drawBattle(); break;
      case 'pauseMenu': drawPauseMenu(); break;
      case 'shop': drawShop(); break;
      case 'inn': drawInn(); break;
      case 'ending': drawEnding(); break;
      case 'ranking': drawRanking(); break;
    }

    requestAnimationFrame(loop);
  }

  enterTitle();
  requestAnimationFrame(loop);
})();
