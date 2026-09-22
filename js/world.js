// フィールド(ワールドマップ・町・ダンジョン)の歩行・イベント・描画
(function(global){
  "use strict";
  const GD = GameData;
  const PX = PixelArt;
  const TILE = 24;

  const TILE_SPRITE = {
    '.':PX.tiles.grass, ',':PX.tiles.path, '~':PX.tiles.water, 'T':PX.tiles.tree,
    '^':PX.tiles.mountain, 'S':PX.tiles.sand, 'N':PX.tiles.snow, 'C':PX.tiles.cave,
    'F':PX.tiles.floor, 'W':PX.tiles.wall
  };
  const TILE_BLOCKED = {'~':true,'T':true,'^':true,'W':true};

  function pickWeighted(table){
    const total = table.reduce((a,t)=>a+t.w,0);
    let r = Math.random()*total;
    for(const t of table){ r-=t.w; if(r<=0) return t.id; }
    return table[0].id;
  }

  function World(state, callbacks){
    this.state = state;
    this.cb = callbacks; // {onDialogue, onShopOpen, onInnOpen, onBattleStart, onTransition, onFlagSet}
    this.player = {x:5,y:4,dir:'down',moving:false,animT:0};
    this.moveCooldown = 0;
    this.current = null;
    this.mapKey = null;
    this.enterMap(state.position.map, state.position.x, state.position.y, state.position.dir);
  }

  World.prototype.buildMap = function(key){
    if(key==='world'){
      return {
        key:'world', type:'world', grid:GD.worldGrid, w:GD.WORLD_W, h:GD.WORLD_H,
        bgMusic:'field'
      };
    }
    const townCfg = GD.TOWN_CONFIGS.find(t=>t.id===key);
    if(townCfg){
      return {
        key, type:'town', grid:GD.townGrid(), w:11, h:9,
        name:townCfg.name, shopId:townCfg.shopId, npcsCfg:townCfg,
        bgMusic:'town'
      };
    }
    const dg = GD.DUNGEONS[key];
    if(dg){
      return {
        key, type:'dungeon', grid:dg.grid, w:9, h:dg.h,
        name:dg.name, dungeonData:dg,
        bgMusic:'dungeon'
      };
    }
    return null;
  };

  World.prototype.enterMap = function(key, x, y, dir){
    this.mapKey = key;
    this.current = this.buildMap(key);
    this.player.x = x; this.player.y = y; this.player.dir = dir||'down';
    this.player.moving = false;
    if(this.cb.onMapEnter) this.cb.onMapEnter(this.current);
  };

  World.prototype.isNpcVisible = function(npc){
    return npc.visibleIf ? npc.visibleIf(this.state.flags) : true;
  };

  World.prototype._npcAt = function(x,y){
    const m = this.current;
    if(m.type==='world'){
      return GD.WORLD_GUARDS.find(n=>n.x===x && n.y===y && this.isNpcVisible(n));
    }
    if(m.type==='town'){
      const npcs = GD.buildTownNpcs(m.npcsCfg);
      return npcs.find(n=>n.x===x && n.y===y && this.isNpcVisible(n));
    }
    return null;
  };

  World.prototype._chestAt = function(x,y){
    const m = this.current;
    if(m.type!=='dungeon') return null;
    const dg = m.dungeonData;
    if(dg.chestPos.x===x && dg.chestPos.y===y) return dg;
    return null;
  };

  World.prototype._exitAt = function(x,y){
    const m = this.current;
    if(m.type==='world'){
      return GD.WORLD_ENTRANCES.find(e=>e.x===x && e.y===y);
    }
    if(m.type==='town'){
      if(x===5 && y===8) return {toWorld:true, ret:GD.TOWN_RETURN[m.key]};
    }
    if(m.type==='dungeon'){
      const dg = m.dungeonData;
      if(dg.entrance.x===x && dg.entrance.y===y) return {toWorld:true, ret:GD.DUNGEON_RETURN[m.key]};
    }
    return null;
  };

  World.prototype.tileAt = function(x,y){
    const m = this.current;
    if(y<0||y>=m.h||x<0||x>=m.w) return 'W';
    return m.grid[y][x];
  };

  World.prototype.isBlocked = function(x,y){
    const t = this.tileAt(x,y);
    if(TILE_BLOCKED[t]) return true;
    if(this._npcAt(x,y)) return true;
    if(this._chestAt(x,y)) return true;
    return false;
  };

  World.prototype.face = function(dir){ this.player.dir = dir; };

  World.prototype.tryMove = function(dir){
    if(this.moveCooldown>0) return;
    this.face(dir);
    let nx=this.player.x, ny=this.player.y;
    if(dir==='up') ny--; else if(dir==='down') ny++; else if(dir==='left') nx--; else if(dir==='right') nx++;

    const npc = this._npcAt(nx,ny);
    if(npc){ this.moveCooldown=0.22; this._interactNpc(npc); return; }
    const chest = this._chestAt(nx,ny);
    if(chest){ this.moveCooldown=0.22; this._openChest(chest); return; }
    if(this.isBlocked(nx,ny)){ this.moveCooldown=0.12; return; }

    this.player.x = nx; this.player.y = ny;
    this.moveCooldown = 0.16;
    this.player.animT = 0;
    GameAudio.sfx.step();
    this._afterMove();
  };

  World.prototype._afterMove = function(){
    const m = this.current;
    const exit = this._exitAt(this.player.x, this.player.y);
    if(exit){
      if(exit.toWorld){
        this.enterMap('world', exit.ret.x, exit.ret.y, 'down');
      } else {
        const target = this.buildMap(exit.target);
        let sx, sy;
        if(target.type==='town'){ sx=5; sy=7; }
        else { sx=target.dungeonData.entrance.x; sy=target.dungeonData.entrance.y-1; }
        this.enterMap(exit.target, sx, sy, 'down');
      }
      return;
    }
    if(m.type==='dungeon'){
      const dg = m.dungeonData;
      const bz = dg.bossZone;
      if(!this.state.flags[dg.flag] && this.player.x>=bz.x0 && this.player.x<=bz.x1 && this.player.y>=bz.y0 && this.player.y<=bz.y1){
        this.cb.onBattleStart([dg.bossId], true, dg.flag, dg.id);
        return;
      }
    }
    if(m.type==='world' || m.type==='dungeon'){
      const table = m.type==='world' ? GD.encounterTableForWorldY(this.player.y) : m.dungeonData.table;
      const rate = m.type==='world' ? 0.075 : 0.11;
      if(Math.random()<rate){
        this.cb.onBattleStart([pickWeighted(table)], false, null, null);
      }
    }
  };

  World.prototype._interactNpc = function(npc){
    GameAudio.sfx.confirm();
    if(npc.shopId){
      this.cb.onDialogue(npc.dialogue, npc.name, ()=>{ this.cb.onShopOpen(npc.shopId); });
    } else if(npc.innHeal){
      this.cb.onDialogue(npc.dialogue, npc.name, ()=>{ this.cb.onInnOpen(npc); });
    } else {
      this.cb.onDialogue(npc.dialogue, npc.name, null);
    }
  };

  World.prototype._openChest = function(dg){
    const flagKey = 'chest_'+dg.id;
    if(this.state.flags[flagKey]){
      this.cb.onDialogue(['空っぽの宝箱だった。'], null, null);
      return;
    }
    this.state.flags[flagKey] = true;
    GameAudio.sfx.open();
    if(dg.chestEquip){
      Player.acquireEquip(this.state, dg.chestEquip);
      const eq = GD.getEquip(dg.chestEquip);
      this.cb.onDialogue(['宝箱をみつけた!', eq.name+'を てにいれた!'], null, null);
    } else if(dg.chestItem){
      Player.addItem(this.state, dg.chestItem, 1);
      const it = GD.getItem(dg.chestItem);
      this.cb.onDialogue(['宝箱をみつけた!', it.name+'を てにいれた!'], null, null);
    }
  };

  World.prototype.update = function(dt){
    if(this.moveCooldown>0) this.moveCooldown -= dt;
    this.player.animT += dt;
  };

  World.prototype.savePosition = function(){
    this.state.position = {map:this.mapKey, x:this.player.x, y:this.player.y, dir:this.player.dir};
  };

  World.prototype.draw = function(ctx, W, H){
    const m = this.current;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,W,H);
    const mapPixelW = m.w*TILE, mapPixelH = m.h*TILE;
    let camX = Math.round(this.player.x*TILE - W/2 + TILE/2);
    let camY = Math.round(this.player.y*TILE - H/2 + TILE/2);
    camX = mapPixelW<=W ? -Math.round((W-mapPixelW)/2) : Math.max(0, Math.min(camX, mapPixelW-W));
    camY = mapPixelH<=H ? -Math.round((H-mapPixelH)/2) : Math.max(0, Math.min(camY, mapPixelH-H));
    const cols = Math.ceil(W/TILE)+2;
    const rows = Math.ceil(H/TILE)+2;
    const startCol = Math.floor(camX/TILE)-1;
    const startRow = Math.floor(camY/TILE)-1;

    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const gx = startCol+c, gy = startRow+r;
        if(gy<0||gy>=m.h||gx<0||gx>=m.w) continue;
        const ch = m.grid[gy][gx];
        const spr = TILE_SPRITE[ch] || PX.tiles.grass;
        const sx = gx*TILE-camX, sy = gy*TILE-camY;
        PX.drawSprite(ctx, spr, sx, sy, TILE);
      }
    }

    // 出入り口の見た目
    const exits = m.type==='world' ? GD.WORLD_ENTRANCES : (m.type==='town' ? [{x:5,y:8,toWorld:true}] : [{x:m.dungeonData.entrance.x,y:m.dungeonData.entrance.y,toWorld:true}]);
    exits.forEach(e=>{
      const sx = e.x*TILE-camX, sy = e.y*TILE-camY;
      if(sx<-TILE||sy<-TILE||sx>W||sy>H) return;
      const spr = e.toWorld ? PX.tiles.door : (e.target && e.target.indexOf('town')===0 ? PX.tiles.door : PX.tiles.stairs);
      PX.drawSprite(ctx, spr, sx, sy, TILE);
    });
    if(m.type==='dungeon' && !this.state.flags['chest_'+m.dungeonData.id]){
      const cp = m.dungeonData.chestPos;
      const sx = cp.x*TILE-camX, sy = cp.y*TILE-camY;
      PX.drawSprite(ctx, PX.tiles.chest, sx, sy, TILE);
    }

    const npcList = m.type==='world' ? GD.WORLD_GUARDS.filter(n=>this.isNpcVisible(n)) : (m.type==='town' ? GD.buildTownNpcs(m.npcsCfg) : []);
    npcList.forEach(n=>{
      const sx = n.x*TILE-camX, sy = n.y*TILE-camY;
      if(sx<-TILE||sy<-TILE||sx>W||sy>H) return;
      const spr = PX.npcTemplate(n.hair, n.cloth);
      PX.drawSprite(ctx, spr, sx, sy, TILE);
    });

    const bob = Math.sin(this.player.animT*10)*2*(this.moveCooldown>0?1:0);
    const px = this.player.x*TILE-camX, py = this.player.y*TILE-camY+bob;
    const preset = GD.GENDER_PRESETS[this.state.gender];
    let tmpl, flip=false;
    if(this.player.dir==='down') tmpl = PX.heroTemplate(preset.hair, preset.cloth);
    else if(this.player.dir==='up') tmpl = PX.heroBackTemplate(preset.hair, preset.cloth);
    else { tmpl = PX.heroSideTemplate(preset.hair, preset.cloth); flip = this.player.dir==='left'; }
    PX.drawSprite(ctx, tmpl, px, py, TILE, {flipX:flip});
  };

  global.World = World;
})(window);
