// ターン制コマンドバトルのロジックと描画
(function(global){
  "use strict";
  const GD = GameData;
  const PX = PixelArt;

  function physDmg(atk, def){
    let base = atk*1.6 - def*0.85;
    base = Math.max(1, base);
    const variance = 0.85 + Math.random()*0.3;
    return Math.max(1, Math.round(base*variance));
  }
  function magDmg(mag, def, power){
    let base = mag*power - def*0.25;
    base = Math.max(1, base);
    const variance = 0.9 + Math.random()*0.2;
    return Math.max(1, Math.round(base*variance));
  }
  function critChance(luk){ return Math.max(3, Math.min(35, luk*0.6+3))/100; }
  function evadeChance(targetSpd, attackerSpd){ return Math.max(2, Math.min(28, (targetSpd-attackerSpd)*0.6+4))/100; }

  function makeEnemyInstance(monsterId, idx){
    const m = GD.MONSTERS[monsterId];
    return Object.assign({}, m, {curHp:m.hp, uid: monsterId+'_'+idx+'_'+Math.floor(Math.random()*99999)});
  }

  function Battle(state, enemyIds, opts){
    this.state = state;
    this.opts = opts || {};
    this.enemies = enemyIds.map((id,i)=>makeEnemyInstance(id,i));
    this.phase = 'intro';
    this.commandMenu = new UI.Menu([
      {label:'たたかう', cmd:'attack'},
      {label:'とくぎ', cmd:'skill'},
      {label:'どうぐ', cmd:'item'},
      {label:'にげる', cmd:'run'}
    ], {cols:2});
    this.targetMenu = null;
    this.subMenu = null;
    this.msgQueue = [];
    this.dialogue = null;
    this.afterMessages = null;
    this.roundQueue = [];
    this.roundIndex = 0;
    this.pendingPlayerAction = null;
    this.escaped = false;
    this.result = null;
    this.shakeTimer = 0;
    this.flashTarget = null;
    this.enemyIntroShown = false;

    const introNames = this.enemies.map(e=>e.name).join('と');
    const introLines = (GD.STORY.bossIntro[this.enemies[0].id]) || [introNames+'が あらわれた!'];
    this.queueMessages(introLines, ()=>{ this.phase='command'; });
  }

  Battle.prototype.livingEnemies = function(){ return this.enemies.filter(e=>e.curHp>0); };
  Battle.prototype.playerStats = function(){ return Player.effectiveStats(this.state); };

  Battle.prototype.queueMessages = function(lines, after){
    this.msgQueue = this.msgQueue.concat(lines);
    this.afterMessages = after || null;
    if(!this.dialogue){ this._nextMessage(); }
    this.phase = 'message';
  };
  Battle.prototype._nextMessage = function(){
    if(this.msgQueue.length===0){
      this.dialogue = null;
      const cb = this.afterMessages;
      this.afterMessages = null;
      if(cb) cb();
      return;
    }
    const text = this.msgQueue.shift();
    this.dialogue = new UI.Dialogue([text], {speed:42});
  };

  Battle.prototype.confirm = function(){
    if(this.phase==='message'){
      if(this.dialogue){
        const finished = this.dialogue.confirm();
        if(finished) this._nextMessage();
      }
      return;
    }
    if(this.phase==='command'){
      const sel = this.commandMenu.selected();
      GameAudio.sfx.confirm();
      if(sel.cmd==='attack'){
        this._chooseTarget((enemy)=>{ this.pendingPlayerAction={type:'attack', target:enemy}; this._startRound(); });
      } else if(sel.cmd==='skill'){
        const skills = Player.knownSkills(this.state).filter(s=>s.id!=='attack');
        if(skills.length===0){ this.queueMessages(['まだ使えるとくぎがない!'], ()=>{this.phase='command';}); return; }
        const skillItems = skills.map(s=>({label:s.name, rightLabel:'MP'+s.mp, skill:s}));
        skillItems.push({label:'もどる', back:true});
        this.subMenu = new UI.Menu(skillItems, {cols:1});
        this.phase = 'skillList';
      } else if(sel.cmd==='item'){
        const usable = this.state.inventory.filter(i=>i.qty>0);
        if(usable.length===0){ this.queueMessages(['どうぐを持っていない!'], ()=>{this.phase='command';}); return; }
        const itemItems = usable.map(i=>{ const def=GD.getItem(i.id); return {label:def.name, rightLabel:'x'+i.qty, itemId:i.id}; });
        itemItems.push({label:'もどる', back:true});
        this.subMenu = new UI.Menu(itemItems, {cols:1});
        this.phase = 'itemList';
      } else if(sel.cmd==='run'){
        this.pendingPlayerAction = {type:'run'};
        this._startRound();
      }
      return;
    }
    if(this.phase==='skillList'){
      const sel = this.subMenu.selected();
      if(sel.back){ this.phase='command'; return; }
      if(this.state.mp < sel.skill.mp){ this.queueMessages(['MPが足りない!'], ()=>{this.phase='skillList';}); return; }
      GameAudio.sfx.confirm();
      if(sel.skill.type==='heal'){
        this.pendingPlayerAction = {type:'skill', skill:sel.skill, target:null};
        this._startRound();
      } else if(sel.skill.target==='all'){
        this.pendingPlayerAction = {type:'skill', skill:sel.skill, target:null};
        this._startRound();
      } else {
        this._chooseTarget((enemy)=>{ this.pendingPlayerAction={type:'skill', skill:sel.skill, target:enemy}; this._startRound(); });
      }
      return;
    }
    if(this.phase==='itemList'){
      const sel = this.subMenu.selected();
      if(sel.back){ this.phase='command'; return; }
      GameAudio.sfx.confirm();
      this.pendingPlayerAction = {type:'item', itemId:sel.itemId};
      this._startRound();
      return;
    }
    if(this.phase==='targetSelect'){
      const enemy = this.targetMenu.selected().enemy;
      GameAudio.sfx.confirm();
      const cb = this._targetCallback;
      this._targetCallback = null;
      this.phase = 'command';
      if(cb) cb(enemy);
      return;
    }
    if(this.phase==='victory' || this.phase==='defeat' || this.phase==='escape'){
      if(this.opts.onEnd) this.opts.onEnd(this._buildEndResult());
      return;
    }
  };

  Battle.prototype._chooseTarget = function(cb){
    const living = this.livingEnemies();
    if(living.length===1){ cb(living[0]); return; }
    this.targetMenu = new UI.Menu(living.map(e=>({label:e.name, rightLabel:e.curHp+'/'+e.hp, enemy:e})), {cols:1});
    this._targetCallback = cb;
    this.phase = 'targetSelect';
  };

  Battle.prototype.cancel = function(){
    if(this.phase==='skillList' || this.phase==='itemList'){ this.phase='command'; GameAudio.sfx.cancel(); }
    else if(this.phase==='targetSelect'){ this.phase='command'; GameAudio.sfx.cancel(); }
  };

  Battle.prototype.move = function(dir){
    if(this.phase==='command') this.commandMenu.move(dir==='left'||dir==='right'?dir:(dir==='up'?'up':'down'));
    else if(this.phase==='skillList' || this.phase==='itemList') this.subMenu.move(dir);
    else if(this.phase==='targetSelect') this.targetMenu.move(dir);
  };

  Battle.prototype._startRound = function(){
    const pStats = this.playerStats();
    const order = [{type:'player', spd:pStats.spd+Math.random()*3}];
    this.livingEnemies().forEach(e=>order.push({type:'enemy', ref:e, spd:e.spd+Math.random()*3}));
    order.sort((a,b)=>b.spd-a.spd);
    this.roundQueue = order;
    this.roundIndex = 0;
    this.phase = 'resolving';
    this._processNext();
  };

  Battle.prototype._processNext = function(){
    if(this.result){ return; }
    if(this.livingEnemies().length===0){ this._onVictory(); return; }
    if(this.state.hp<=0){ this._onDefeat(); return; }
    if(this.escaped){ this._onEscape(); return; }
    if(this.roundIndex >= this.roundQueue.length){
      this.phase='command';
      return;
    }
    const entry = this.roundQueue[this.roundIndex];
    this.roundIndex++;
    if(entry.type==='player'){
      this._resolvePlayerAction();
    } else {
      if(entry.ref.curHp<=0){ this._processNext(); return; }
      this._resolveEnemyAction(entry.ref);
    }
  };

  Battle.prototype._resolvePlayerAction = function(){
    const act = this.pendingPlayerAction;
    const pStats = this.playerStats();
    if(act.type==='attack'){
      const target = act.target;
      if(target.curHp<=0){ this._processNext(); return; }
      const ev = evadeChance(target.spd, pStats.spd);
      if(Math.random()<ev){
        GameAudio.sfx.attack();
        this.queueMessages([target.name+'に こうげき! しかし はずれた!'], ()=>this._processNext());
      } else {
        let dmg = physDmg(pStats.atk, target.def);
        const isCrit = Math.random()<critChance(pStats.luk);
        if(isCrit) dmg = Math.round(dmg*1.8);
        target.curHp = Math.max(0, target.curHp-dmg);
        GameAudio.sfx.attack();
        this.shakeTimer = 0.25;
        const line = target.name+'に '+dmg+'の ダメージ!'+(isCrit?'(会心の一撃!)':'');
        this.queueMessages([line], ()=>{
          if(target.curHp<=0) this.queueMessages([target.name+'を たおした!'], ()=>this._processNext());
          else this._processNext();
        });
      }
    } else if(act.type==='skill'){
      const skill = act.skill;
      this.state.mp -= skill.mp;
      if(skill.type==='heal'){
        const before = this.state.hp;
        const amount = skill.power>=9999 ? Player.maxHp(this.state) : skill.power;
        this.state.hp = Math.min(Player.maxHp(this.state), this.state.hp+amount);
        GameAudio.sfx.heal();
        this.queueMessages([skill.name+'を となえた!', 'HPが '+(this.state.hp-before)+' かいふくした!'], ()=>this._processNext());
      } else if(skill.target==='all'){
        GameAudio.sfx.magic();
        const lines = [skill.name+'を となえた!'];
        this.livingEnemies().forEach(en=>{
          const mult = GD.elementMultiplier(skill.element, en);
          const dmg = Math.round(magDmg(pStats.mag, en.def, skill.power)*mult);
          en.curHp = Math.max(0, en.curHp-dmg);
          lines.push(en.name+'に '+dmg+'の ダメージ!');
        });
        this.queueMessages(lines, ()=>{
          const lines2 = this.enemies.filter(e=>e.curHp<=0 && !e._announcedDead).map(e=>{ e._announcedDead=true; return e.name+'を たおした!'; });
          if(lines2.length) this.queueMessages(lines2, ()=>this._processNext()); else this._processNext();
        });
      } else {
        const target = act.target;
        GameAudio.sfx.magic();
        const mult = GD.elementMultiplier(skill.element, target);
        const dmg = Math.round(magDmg(pStats.mag, target.def, skill.power)*mult);
        target.curHp = Math.max(0, target.curHp-dmg);
        const weakNote = mult>=2 ? '(弱点をついた!)' : (mult<=0.5 ? '(効果はいまひとつ…)' : '');
        this.queueMessages([skill.name+'を となえた!', target.name+'に '+dmg+'の ダメージ!'+weakNote], ()=>{
          if(target.curHp<=0) this.queueMessages([target.name+'を たおした!'], ()=>this._processNext());
          else this._processNext();
        });
      }
    } else if(act.type==='item'){
      const res = Player.useItem(this.state, act.itemId);
      GameAudio.sfx.heal();
      this.queueMessages([GD.getItem(act.itemId).name+'を つかった!', res.text], ()=>this._processNext());
    } else if(act.type==='run'){
      const pStats2 = this.playerStats();
      const avgSpd = this.livingEnemies().reduce((a,e)=>a+e.spd,0)/Math.max(1,this.livingEnemies().length);
      const chance = Math.max(0.1, Math.min(0.9, 0.5+(pStats2.spd-avgSpd)*0.03));
      if(Math.random()<chance){
        GameAudio.sfx.run();
        this.escaped = true;
        this.queueMessages(['うまく にげきれた!'], ()=>this._processNext());
      } else {
        this.queueMessages(['にげられなかった!'], ()=>this._processNext());
      }
    }
  };

  Battle.prototype._resolveEnemyAction = function(enemy){
    const pStats = this.playerStats();
    const roll = Math.random();
    let dmg, isMagic=false, isSpecial=false;
    if(enemy.isBoss && roll<0.2){
      isSpecial = true;
      dmg = Math.round(physDmg(enemy.atk, pStats.def)*1.6);
    } else if(enemy.mag > enemy.atk*0.5 && roll<0.55){
      isMagic = true;
      dmg = magDmg(enemy.mag, pStats.def, 1.5);
      if(Player.hasAllResist(this.state)) dmg = Math.round(dmg*0.6);
    } else {
      const ev = evadeChance(pStats.spd, enemy.spd);
      if(Math.random()<ev){
        GameAudio.sfx.attack();
        this.queueMessages([enemy.name+'の こうげき! しかし はずれた!'], ()=>this._processNext());
        return;
      }
      dmg = physDmg(enemy.atk, pStats.def);
      const isCrit = Math.random()<critChance(enemy.luk);
      if(isCrit) dmg = Math.round(dmg*1.8);
    }
    this.state.hp = Math.max(0, this.state.hp-dmg);
    GameAudio.sfx.hit();
    this.shakeTimer = 0.25;
    const verb = isSpecial ? 'の 強烈な一撃!' : (isMagic ? 'の 魔法こうげき!' : 'の こうげき!');
    this.queueMessages([enemy.name+verb+' '+dmg+'の ダメージ!'], ()=>this._processNext());
  };

  Battle.prototype._onVictory = function(){
    this.phase = 'victoryProcessing';
    let exp=0, gold=0;
    const drops = [];
    this.enemies.forEach(e=>{
      exp += e.exp; gold += e.gold;
      Player.addBestiary(this.state, e.id);
      (e.drops||[]).forEach(d=>{ if(Math.random()<d.chance) drops.push(d); });
    });
    Player.gainGold(this.state, gold);
    drops.forEach(d=>{
      if(d.type==='item') Player.addItem(this.state, d.id, 1);
      else { Player.acquireEquip(this.state, d.id); }
    });
    const lvRes = Player.gainExp(this.state, exp);
    const lines = ['せんとうに しょうりした!', exp+'の けいけんちと '+gold+'Gを てにいれた!'];
    drops.forEach(d=>{
      const def = d.type==='item' ? GD.getItem(d.id) : GD.getEquip(d.id);
      lines.push(def.name+'を てにいれた!');
    });
    if(lvRes.leveledUp){ lines.push('レベルが '+lvRes.newLevel+' に あがった!'); }
    this.queueMessages(lines, ()=>{
      this.phase='victory';
      this.result = 'victory';
      if(lvRes.leveledUp) GameAudio.sfx.levelup(); else GameAudio.sfx.victory();
    });
  };
  Battle.prototype._onDefeat = function(){
    this.phase='message';
    this.queueMessages(['ちからつきてしまった…'], ()=>{ this.phase='defeat'; this.result='defeat'; GameAudio.sfx.gameover(); });
  };
  Battle.prototype._onEscape = function(){
    this.phase='escape';
    this.result='escape';
  };

  Battle.prototype._buildEndResult = function(){
    return {result:this.result, bossDefeated: this.enemies.some(e=>e.isBoss) && this.result==='victory', bossId: this.enemies[0] && this.enemies[0].id};
  };

  Battle.prototype.update = function(dt){
    if(this.dialogue) this.dialogue.update(dt);
    if(this.shakeTimer>0) this.shakeTimer -= dt;
  };

  Battle.prototype.draw = function(ctx, W, H){
    ctx.fillStyle = '#0a0e22';
    ctx.fillRect(0,0,W,H);
    const grad = ctx.createLinearGradient(0,0,0,H*0.6);
    grad.addColorStop(0,'#26305c');
    grad.addColorStop(1,'#141a38');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H*0.55);

    const living = this.enemies;
    const n = living.length;
    const spacing = W/(n+1);
    living.forEach((e,i)=>{
      if(e.curHp<=0) return;
      const shape = PX.monsterShapes[e.shape];
      const size = e.isBoss ? 88 : 56;
      let cx = spacing*(i+1) - size/2;
      let cy = H*0.28 - size/2;
      if(this.shakeTimer>0 && i===0) cx += (Math.random()-0.5)*6;
      PX.drawSprite(ctx, shape, cx, cy, size, {palette:e.palette});
      ctx.save();
      ctx.fillStyle = '#f4f4f8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.name, cx+size/2, cy+size+12);
      const barW = Math.min(70,size);
      UI.drawBar(ctx, cx+size/2-barW/2, cy+size+16, barW, 6, e.curHp/e.hp, UI.COL.hp, UI.COL.hpBg);
      ctx.restore();
    });

    const bottomY = H*0.56;
    const pStats = this.playerStats();
    const statusH = 54;
    UI.drawWindow(ctx, 8, bottomY, W-16, statusH);
    ctx.save();
    ctx.fillStyle = UI.COL.text;
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(this.state.name+' Lv'+Player.level(this.state), 18, bottomY+8);
    ctx.fillText('HP', 18, bottomY+26);
    UI.drawBar(ctx, 44, bottomY+27, 90, 9, this.state.hp/pStats.hp, UI.COL.hp, UI.COL.hpBg);
    ctx.fillText(this.state.hp+'/'+pStats.hp, 138, bottomY+26);
    ctx.fillText('MP', 18, bottomY+40);
    UI.drawBar(ctx, 44, bottomY+41, 90, 9, this.state.mp/Math.max(1,pStats.mp), UI.COL.mp, UI.COL.mpBg);
    ctx.fillText(this.state.mp+'/'+pStats.mp, 138, bottomY+40);
    ctx.restore();

    const menuY = bottomY + statusH + 6;
    const menuH = H - menuY - 6;
    if(this.phase==='command'){
      UI.drawMenu(ctx, 8, menuY, W-16, menuH, this.commandMenu, {rowH:26});
    } else if(this.phase==='skillList' || this.phase==='itemList'){
      UI.drawMenu(ctx, 8, menuY, W-16, menuH, this.subMenu, {rowH:22});
    } else if(this.phase==='targetSelect'){
      UI.drawMenu(ctx, 8, menuY, W-16, menuH, this.targetMenu, {rowH:22});
    } else if(this.phase==='message' || this.phase==='victoryProcessing'){
      if(this.dialogue) UI.drawDialogueBox(ctx, W, H, this.dialogue, null);
    } else if(this.phase==='victory'){
      UI.drawWindow(ctx, 8, menuY, W-16, menuH, {accent:true});
      ctx.save();
      ctx.fillStyle = UI.COL.accent;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('タップして つづける', W/2, menuY+menuH/2-6);
      ctx.restore();
    } else if(this.phase==='defeat'){
      UI.drawWindow(ctx, 8, menuY, W-16, menuH);
      ctx.save();
      ctx.fillStyle = UI.COL.hp;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('タップして つづける', W/2, menuY+menuH/2-6);
      ctx.restore();
    } else if(this.phase==='escape'){
      // 何もしない(onEndへ)
      if(this.opts.onEnd) this.opts.onEnd(this._buildEndResult());
    }
  };

  global.Battle = Battle;
})(window);
