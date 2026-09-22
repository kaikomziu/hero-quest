// 手描きドット絵をテキストグリッドで定義し、Canvasにピクセル単位で描画するミニライブラリ
(function(global){
  "use strict";

  function mirrorRows(leftRows){
    // 左半分の行配列を受け取り、左右対称の全体行を返す(奇数幅なら中央列を共有)
    return leftRows.map(r => r + r.split('').reverse().join(''));
  }
  function mirrorRowsOdd(leftRows){
    // 中央列を含む左半分から、中央を共有した対称行を作る
    return leftRows.map(r => r + r.slice(0, -1).split('').reverse().join(''));
  }

  const PA = { // 汎用パレット(キャラクター/モンスター共通トークン)
    K:'#1a1a24', // 輪郭(黒系)
    W:'#f4f4f8', // 白
    SK:'#f2c49a', // 肌
    SKD:'#d69a68', // 肌影
    HR:'#5a3a26', // 髪(既定 茶)
    CL:'#3f6fd6', // 服(既定 青)
    CLD:'#2a4a9c', // 服影
    MT:'#d8d8e0', // 金属
    MTD:'#9a9aa8', // 金属影
    BD:'#7fbf5f', // モンスター体(既定 緑)
    BDD:'#5a9440', // 体影
    EY:'#ffffff',
    PU:'#000000'
  };

  function px(name, w, h, legend, rows){
    return {name, w, h, legend, rows};
  }

  // ---- 主人公(男/女 × front/back/side) 16x16 ----
  const heroLeftF = [ // front, 8px幅(16の左半分)
    '........',
    '...KKK..',
    '..KHHHK.',
    '.KHHHHHK',
    '.KSSSSK.',
    '.KSESK..',
    '.KSSSK..',
    '.KCCCCK.',
    'KCCCCCKK',
    'KCCCCCKK',
    '.KMMMK..',
    '.KMMMK..',
    '.KMMMK..',
    '..KMK...',
    '..KKK...',
    '........'
  ];
  function heroTemplate(hairColor, clothColor){
    const legend = {'.':null,'K':'K','H':'HR','S':'SK','E':'EY','C':'CL','M':'MT'};
    const pal = Object.assign({}, PA, {HR:hairColor, CL:clothColor, CLD:clothColor});
    return {w:16,h:16,legend,rows:mirrorRows(heroLeftF), palette:pal};
  }
  const heroBackLeft = [
    '........',
    '...KKK..',
    '..KHHHK.',
    '.KHHHHHK',
    '.KHHHHHK',
    '.KHHHHHK',
    '.KHHHHK.',
    '.KCCCCK.',
    'KCCCCCKK',
    'KCCCCCKK',
    '.KMMMK..',
    '.KMMMK..',
    '.KMMMK..',
    '..KMK...',
    '..KKK...',
    '........'
  ];
  function heroBackTemplate(hairColor, clothColor){
    const legend = {'.':null,'K':'K','H':'HR','C':'CL','M':'MT'};
    const pal = Object.assign({}, PA, {HR:hairColor, CL:clothColor});
    return {w:16,h:16,legend,rows:mirrorRows(heroBackLeft), palette:pal};
  }
  const heroSideRows = [
    '................',
    '.....KKKK.......',
    '....KHHHHK......',
    '...KHHHHHHK.....',
    '...KSSSSHK......',
    '...KSESSK.......',
    '...KSSSK........',
    '...KCCCCK.......',
    '..KCCCCCCKK.....',
    '..KCCCCCCKK.....',
    '...KMMMK........',
    '...KMMMK........',
    '...KMMMK........',
    '....KMK.KK......',
    '....KKK.KK......',
    '................'
  ];
  function heroSideTemplate(hairColor, clothColor){
    const legend = {'.':null,'K':'K','H':'HR','S':'SK','E':'EY','C':'CL','M':'MT'};
    const pal = Object.assign({}, PA, {HR:hairColor, CL:clothColor});
    return {w:16,h:16,legend,rows:heroSideRows, palette:pal};
  }

  // ---- NPC汎用(色替え用) ----
  const npcLeft = [
    '........',
    '...KKK..',
    '..KHHHK.',
    '.KHHHHHK',
    '.KSSSSK.',
    '.KSESK..',
    '.KSSSK..',
    '.KCCCCK.',
    'KCCCCCKK',
    'KCCCCCKK',
    '.KCCCK..',
    '.KCCCK..',
    '.KCCCK..',
    '..KCK...',
    '..KKK...',
    '........'
  ];
  function npcTemplate(hairColor, clothColor){
    const legend = {'.':null,'K':'K','H':'HR','S':'SK','E':'EY','C':'CL'};
    const pal = Object.assign({}, PA, {HR:hairColor, CL:clothColor});
    return {w:16,h:16,legend,rows:mirrorRows(npcLeft), palette:pal};
  }

  // ---- モンスター基本シェイプ(8種、パレット差し替えで使い回す) 16x16 ----
  const monsterShapes = {};

  monsterShapes.slime = (() => {
    const left = [
      '........',
      '........',
      '..KKKK..',
      '.KBBBBK.',
      'KBBBBBBK',
      'KBBEBBBK',
      'KBBBBBBK',
      'KBDBDBBK',
      'KBBBBBBK',
      '.KBBBBK.',
      '..KKKK..',
      '........',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','D':'BDD','E':'EY'},rows:mirrorRows(left)};
  })();

  monsterShapes.bat = (() => {
    const rows = [
      '................',
      '..KK......KK...',
      '.KBBK....KBBK..',
      'KBBBBKKKKBBBBK.',
      'KBBBBBBBBBBBBK.',
      '.KBBBBBBBBBBK..',
      '..KBBEBBEBBK...',
      '...KBBBBBBK....',
      '....KBBBBK.....',
      '.....KBBK......',
      '......KK.......',
      '................',
      '................',
      '................',
      '................',
      '................'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','E':'EY'},rows};
  })();

  monsterShapes.wolf = (() => {
    const left = [
      '........',
      '........',
      '.KKK....',
      'KBBBK...',
      'KBBBBKKK',
      'KBEBBBBK',
      'KBBBBBBK',
      '.KBBBBBK',
      '.KDDDDBK',
      '.K.KK.KK',
      '.K.KK.K.',
      '........',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','D':'BDD','E':'EY'},rows:mirrorRows(left)};
  })();

  monsterShapes.spider = (() => {
    const left = [
      '........',
      '........',
      '..KKKK..',
      '.KBBBBK.',
      'KBBEBBBK',
      'KBBBBBBK',
      '.KBBBBK.',
      'K.KBBK.K',
      'KK.KK.KK',
      'K..KK..K',
      'K......K',
      '........',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','E':'EY'},rows:mirrorRows(left)};
  })();

  monsterShapes.golem = (() => {
    const left = [
      '........',
      '.KKKKK..',
      'KBBBBBK.',
      'KBEBBBK.',
      'KBBBBBK.',
      'KKBBBKK.',
      '.KBBBK..',
      'KKBBBKK.',
      'KBBBBBK.',
      'KBBBBBK.',
      'KBB.BBK.',
      'KKK.KKK.',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','E':'EY'},rows:mirrorRows(left)};
  })();

  monsterShapes.ghost = (() => {
    const left = [
      '........',
      '..KKKK..',
      '.KBBBBK.',
      'KBBBBBBK',
      'KBBEBBBK',
      'KBBBBBBK',
      'KBBBBBBK',
      'KBBBBBBK',
      'KBBBBBBK',
      'KB.BB.BK',
      'K.KK.KK.',
      '........',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','E':'EY'},rows:mirrorRows(left)};
  })();

  monsterShapes.imp = (() => {
    const left = [
      '........',
      '.K.....K',
      '.KK...KK',
      '..KKKKK.',
      '.KBBBBK.',
      'KBBEBBBK',
      'KBBBBBBK',
      '.KBDDBK.',
      '.KCCCCK.',
      '.KCCCCK.',
      '..K..K..',
      '..K..K..',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','D':'BDD','E':'EY','C':'CLD'},rows:mirrorRows(left)};
  })();

  monsterShapes.skeleton = (() => {
    const left = [
      '........',
      '..KKKK..',
      '.KWWWWK.',
      'KWEWWWWK',
      'KWWWWWWK',
      '.KWWWWK.',
      '..KWWK..',
      '.KWWWWK.',
      'KW.WW.WK',
      'K..WW..K',
      '..KWWK..',
      '..K..K..',
      '........',
      '........',
      '........',
      '........'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','W':'W','E':'PU'},rows:mirrorRows(left)};
  })();

  monsterShapes.dragon = (() => {
    const rows = [
      '................',
      '...KK........KK',
      '..KBBK......KBBK',
      '.KBBBBKKKKKKBBBK',
      'KBBBBBBBBBBBBBBK'.slice(0,16),
      'KBEBBBBBBBBBBBBK',
      '.KBBBBBBBBBBBBK.',
      '..KBBBBBBBBBBK..',
      '..KDDBBBBBBDDK..',
      '..K..KKKKKK..K..',
      '.................'.slice(0,16),
      '................',
      '................',
      '................',
      '................',
      '................'
    ];
    return {w:16,h:16,legend:{'.':null,'K':'K','B':'BD','D':'BDD','E':'EY'},rows};
  })();

  // ---- タイル(16x16) ----
  const tiles = {};
  function fillTile(color){ const r=[]; for(let i=0;i<16;i++) r.push('a'.repeat(16)); return {w:16,h:16,legend:{'a':color === 'grass'?'T1':'T1'},rows:r}; }

  function solidTile(name, hexBase, hexAlt){
    const rows=[];
    for(let y=0;y<16;y++){
      let row='';
      for(let x=0;x<16;x++){ row += ((x+y)%7===0)?'b':'a'; }
      rows.push(row);
    }
    return {name, w:16,h:16,legend:{'a':'T1','b':'T2'},rows,palette:{T1:hexBase,T2:hexAlt}};
  }

  tiles.grass = solidTile('tile_grass','#3d9c40','#46ab48');
  tiles.path  = solidTile('tile_path','#c9a86a','#d3b578');
  tiles.water = (() => {
    const rows=[]; for(let y=0;y<16;y++){ let row=''; for(let x=0;x<16;x++){ row += ((x+y*2)%9<2)?'b':'a'; } rows.push(row); }
    return {name:'tile_water', w:16,h:16,legend:{'a':'T1','b':'T2'},rows,palette:{T1:'#2a6fd6',T2:'#3f8ce8'}};
  })();
  tiles.floor = solidTile('tile_floor','#6b5636','#77613e');
  tiles.sand  = solidTile('tile_sand','#e0c785','#e8d194');
  tiles.snow  = solidTile('tile_snow','#eef4fb','#dde8f5');
  tiles.cave  = solidTile('tile_cave','#4a4552','#544e5c');
  tiles.tree = (() => {
    const left = [
      '..KKKK..',
      '.KBBBBK.',
      'KBBBBBBK',
      'KBBDBBBK',
      '.KBBBBK.',
      '..KTTK..',
      '..KTTK..',
      '..KKKK..',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ];
    return {name:'tile_tree', w:16,h:16,legend:{'.':'T1','K':'K','B':'BD','D':'BDD','T':'HR'},rows:mirrorRows(left),palette:{T1:'#3d9c40'}};
  })();
  tiles.wall = solidTile('tile_wall','#8a7a5c','#7d6d50');
  tiles.mountain = solidTile('tile_mountain','#8a8a92','#7a7a82');
  tiles.chest = (() => {
    const rows = [
      '................',
      '................',
      '................',
      '................',
      '..KKKKKKKKKKKK..',
      '.KHHHHHHHHHHHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHHHKKKKHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      '.KKKKKKKKKKKKKK.',
      '................',
      '................',
      '................',
      '................'
    ];
    return {name:'tile_chest', w:16,h:16,legend:{'.':null,'K':'K','H':'MT'},rows};
  })();
  tiles.door = (() => {
    const rows = [
      '................',
      '................',
      '.KKKKKKKKKKKK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KHHHHHHHHHHK...',
      '.KKKKKKKKKKKK...',
      '................',
      '................',
      '................',
      '................'
    ];
    return {name:'tile_door', w:16,h:16,legend:{'.':null,'K':'K','H':'HR'},rows,palette:{HR:'#6b4426'}};
  })();
  tiles.stairs = (() => {
    const rows=[];
    for(let y=0;y<16;y++){ let row=''; for(let x=0;x<16;x++){ row += (x+y<16 && (x+y)%4<2)?'a':'b'; } rows.push(row); }
    return {name:'tile_stairs', w:16,h:16,legend:{'a':'T1','b':'T2'},rows,palette:{T1:'#2a2a34',T2:'#42424f'}};
  })();

  // ---- 描画関数 ----
  const canvasCache = new Map();
  function renderSpriteToCanvas(sprite, paletteOverride){
    const pal = Object.assign({}, PA, sprite.palette||{}, paletteOverride||{});
    const c = document.createElement('canvas');
    c.width = sprite.w; c.height = sprite.h;
    const cx = c.getContext('2d');
    const img = cx.createImageData(sprite.w, sprite.h);
    for(let y=0;y<sprite.h;y++){
      const row = sprite.rows[y] || '';
      for(let x=0;x<sprite.w;x++){
        const ch = row[x] || '.';
        const key = sprite.legend[ch];
        const colorKey = key || null;
        let hex = null;
        if(colorKey){
          hex = pal[colorKey] || colorKey;
        }
        const idx = (y*sprite.w+x)*4;
        if(hex){
          const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
          img.data[idx]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=255;
        } else {
          img.data[idx+3]=0;
        }
      }
    }
    cx.putImageData(img,0,0);
    return c;
  }

  function drawSprite(ctx, sprite, x, y, size, opts){
    opts = opts || {};
    if(!sprite._rowsKey) sprite._rowsKey = sprite.rows.join('|');
    const basePaletteKey = sprite.palette ? JSON.stringify(sprite.palette) : '';
    const overridePaletteKey = opts.palette ? JSON.stringify(opts.palette) : '';
    const key = (sprite.name||'anon')+'#'+sprite._rowsKey+'#'+basePaletteKey+'#'+overridePaletteKey;
    let c = canvasCache.get(key);
    if(!c){ c = renderSpriteToCanvas(sprite, opts.palette); canvasCache.set(key, c); }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if(opts.flipX){
      ctx.translate(x+size, y);
      ctx.scale(-1,1);
      ctx.drawImage(c, 0, 0, size, size);
    } else {
      ctx.drawImage(c, x, y, size, size);
    }
    ctx.restore();
  }

  function shade(hex, factor){
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const f = (v)=>Math.max(0,Math.min(255,Math.round(v*factor)));
    const toHex = (v)=>v.toString(16).padStart(2,'0');
    return '#'+toHex(f(r))+toHex(f(g))+toHex(f(b));
  }
  function monsterPalette(baseColor, eyeColor){
    return {BD:baseColor, BDD:shade(baseColor,0.68), EY:eyeColor||'#ffffff'};
  }

  global.PixelArt = {
    PA, mirrorRows, mirrorRowsOdd, shade, monsterPalette,
    heroTemplate, heroBackTemplate, heroSideTemplate, npcTemplate,
    monsterShapes, tiles, drawSprite, renderSpriteToCanvas
  };
})(window);
