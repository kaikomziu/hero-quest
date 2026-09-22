// ゲームコンテンツ定義(ステータス式・スキル・アイテム・装備・モンスター・マップ・NPC・ストーリー文)
(function(global){
  "use strict";
  const MG = MapGen;
  const PX = PixelArt;

  // ===== 属性 =====
  const ELEMENTS = ['fire','ice','thunder','none'];
  const ELEMENT_NAME = {fire:'火',ice:'氷',thunder:'雷',none:'無'};
  function elementMultiplier(atkElement, mon){
    if(!atkElement || atkElement === 'none') return 1;
    if(mon.weakness === atkElement) return 2;
    if(mon.resist === atkElement) return 0.5;
    return 1;
  }

  // ===== レベル・経験値 =====
  const MAX_LEVEL = 45;
  const EXP_TABLE = (function(){
    const t=[0,0];
    let total=0;
    for(let lvl=2; lvl<=MAX_LEVEL; lvl++){
      total += Math.floor(15*(lvl-1)*(lvl-1) + 35*(lvl-1));
      t[lvl]=total;
    }
    return t;
  })();
  function levelForExp(exp){
    let lvl=1;
    for(let l=2;l<=MAX_LEVEL;l++){ if(exp>=EXP_TABLE[l]) lvl=l; else break; }
    return lvl;
  }
  function expToNextLevel(exp){
    const lvl = levelForExp(exp);
    if(lvl>=MAX_LEVEL) return null;
    return EXP_TABLE[lvl+1]-exp;
  }

  const BASE_STATS = {hp:32,mp:10,atk:7,def:5,mag:6,spd:7,luk:6};
  const GROWTH = {hp:6.4,mp:1.8,atk:1.5,def:1.2,mag:1.35,spd:1.05,luk:0.9};
  function statsAtLevel(lvl){
    const s={};
    for(const k in BASE_STATS){ s[k]=Math.floor(BASE_STATS[k]+GROWTH[k]*(lvl-1)); }
    return s;
  }

  // ===== 主人公の見た目 =====
  const GENDER_PRESETS = {
    boy: {label:'男の子', hair:'#5a3a26', cloth:'#3f6fd6'},
    girl:{label:'女の子', hair:'#e0a23a', cloth:'#d6488f'}
  };

  // ===== スキル =====
  const SKILLS = [
    {id:'fire',    name:'ファイア',   mp:3,  element:'fire',    power:1.4, type:'magic', target:'enemy', learnLv:3,  desc:'火の魔法で敵1体を攻撃する'},
    {id:'heal',    name:'ヒール',     mp:4,  element:'none',    power:26,  type:'heal',  target:'self',  learnLv:5,  desc:'HPを26回復する'},
    {id:'thunder', name:'サンダー',   mp:6,  element:'thunder', power:1.6, type:'magic', target:'enemy', learnLv:8,  desc:'雷の魔法で敵1体を攻撃する'},
    {id:'ice',     name:'アイス',     mp:8,  element:'ice',     power:1.8, type:'magic', target:'enemy', learnLv:12, desc:'氷の魔法で敵1体を攻撃する'},
    {id:'healra',  name:'ハイヒール', mp:10, element:'none',    power:70,  type:'heal',  target:'self',  learnLv:16, desc:'HPを70回復する'},
    {id:'meteo',   name:'メテオ',     mp:16, element:'fire',    power:1.7, type:'magic', target:'all',   learnLv:20, desc:'敵全体に火の魔法攻撃'},
    {id:'fullheal',name:'フルヒール', mp:14, element:'none',    power:9999,type:'heal',  target:'self',  learnLv:26, desc:'HPを全回復する'},
    {id:'thundaga',name:'サンダガ',   mp:22, element:'thunder', power:2.0, type:'magic', target:'all',   learnLv:32, desc:'敵全体に雷の魔法攻撃'},
    {id:'ultima',  name:'アルテマ',   mp:30, element:'none',    power:2.6, type:'magic', target:'all',   learnLv:40, desc:'すべての力を解き放つ最強魔法'}
  ];
  function skillsKnownAtLevel(lvl){ return SKILLS.filter(s=>s.learnLv<=lvl); }

  // ===== アイテム =====
  const ITEMS = [
    {id:'herb',     name:'やくそう',   price:8,   sell:4,  effect:{type:'heal_hp', amount:30}, desc:'HPを30回復する'},
    {id:'hipotion', name:'やくそうG',  price:35,  sell:17, effect:{type:'heal_hp', amount:90}, desc:'HPを90回復する'},
    {id:'mppotion', name:'せいすい',   price:30,  sell:15, effect:{type:'heal_mp', amount:25}, desc:'MPを25回復する'},
    {id:'elixir',   name:'エリクサー', price:150, sell:75, effect:{type:'full_heal'},          desc:'HP・MPを全回復する'}
  ];
  function getItem(id){ return ITEMS.find(i=>i.id===id); }

  // ===== 装備 =====
  const EQUIPMENT = [
    {id:'w_starter',   name:'そまつなつるぎ',   slot:'weapon', atk:1,  price:0,    sell:1,   desc:'旅立ちの村でもらった剣'},
    {id:'a_starter',   name:'そまつなふく',     slot:'armor',  def:1,  price:0,    sell:1,   desc:'旅立ちの村でもらった服'},

    {id:'w_woodsword', name:'どうのつるぎ',     slot:'weapon', atk:3,  price:60,   sell:30,  desc:'銅でできた初心者向けの剣'},
    {id:'w_ironsword',  name:'てつのつるぎ',    slot:'weapon', atk:8,  price:220,  sell:110, desc:'鉄でできたしっかりした剣'},
    {id:'w_mithsword',  name:'ミスリルのつるぎ',slot:'weapon', atk:15, price:650,  sell:320, desc:'軽くて鋭いミスリル製の剣'},
    {id:'w_steelgreat', name:'はがねの大剣',    slot:'weapon', atk:23, price:1400, sell:700, desc:'重厚な鋼鉄の大剣'},
    {id:'w_lightblade',  name:'ひかりのつるぎ', slot:'weapon', atk:33, price:3200, sell:1600,desc:'ほのかに光る聖なる剣'},
    {id:'w_poisonFang',  name:'どくばりのたんけん', slot:'weapon', atk:10, mag:0, luk:3, price:0, sell:200, dropOnly:true, desc:'大蜘蛛の毒針から作られた短剣'},
    {id:'w_iceBlade',    name:'こおりのやいば', slot:'weapon', atk:18, mag:6, price:0, sell:500, dropOnly:true, desc:'氷のトロルの爪から鍛えられた刃'},
    {id:'w_maouSword',   name:'まおうぎりのつるぎ', slot:'weapon', atk:48, mag:10, price:0, sell:3000, dropOnly:true, desc:'伝説の古竜が守っていた最強の剣'},

    {id:'a_clothrobe',  name:'ぬののふく',     slot:'armor', def:2,  price:50,   sell:25,  desc:'薄手の布の服'},
    {id:'a_leather',    name:'かわのよろい',   slot:'armor', def:6,  price:200,  sell:100, desc:'革でできた軽い鎧'},
    {id:'a_chain',      name:'くさりかたびら', slot:'armor', def:11, price:600,  sell:300, desc:'鎖でできた頑丈な鎧'},
    {id:'a_ironarmor',  name:'てつのよろい',   slot:'armor', def:17, price:1300, sell:650, desc:'鉄の全身鎧'},
    {id:'a_mithArmor',  name:'ミスリルのよろい',slot:'armor', def:25, price:3000, sell:1500,desc:'軽くて丈夫なミスリルの鎧'},
    {id:'a_earthArmor', name:'だいちのよろい', slot:'armor', def:22, luk:4, price:0, sell:900, dropOnly:true, desc:'砂の巨人の core から作られた鎧'},
    {id:'a_legendArmor',name:'でんせつのよろい',slot:'armor', def:35, price:9000, sell:4500, postgame:true, desc:'伝説の勇者が纏っていたという鎧'},

    {id:'ac_powerarm',  name:'ちからのうでわ', slot:'accessory', atk:4, price:150, sell:75,  desc:'力がみなぎる腕輪'},
    {id:'ac_magring',   name:'まほうのゆびわ', slot:'accessory', mag:5, price:150, sell:75,  desc:'魔力が高まる指輪'},
    {id:'ac_speedboots',name:'すばやさのくつ', slot:'accessory', spd:4, price:180, sell:90,  desc:'足取りが軽くなるくつ'},
    {id:'ac_guardcharm',name:'まもりのお守り', slot:'accessory', def:4, luk:3, price:220, sell:110, desc:'身を守るお守り'},
    {id:'ac_seawindGauntlet', name:'しおかぜのこて', slot:'accessory', spd:6, luk:3, price:0, sell:400, dropOnly:true, desc:'幼体クラーケンの鱗で作られたこて'},
    {id:'ac_dragonscale', name:'りゅうのうろこ', slot:'accessory', def:10, allResist:true, price:5000, sell:2500, postgame:true, desc:'あらゆる属性の力を和らげる鱗'},
    {id:'ac_chaosOrb', name:'こんとんのオーブ', slot:'accessory', atk:10, mag:10, spd:8, luk:8, price:0, sell:5000, dropOnly:true, desc:'古竜の力の残滓が宿るオーブ'}
  ];
  function getEquip(id){ return EQUIPMENT.find(e=>e.id===id); }

  // ===== モンスター =====
  const MP = PX.monsterPalette;
  function skelPal(bone, eye){ return {W:bone, PU:eye}; }

  const MONSTERS = {
    slime:        {id:'slime', name:'スライム', shape:'slime', palette:MP('#5fbf5f','#ffffff'), hp:14,atk:5,def:2,mag:1,spd:4,luk:3,exp:4,gold:3, weakness:'fire', drops:[{id:'herb',chance:0.3,type:'item'}]},
    bat1:         {id:'bat1', name:'ちびコウモリ', shape:'bat', palette:MP('#8a5fbf','#ffdd55'), hp:10,atk:6,def:1,mag:1,spd:9,luk:5,exp:4,gold:3, weakness:'thunder', drops:[{id:'herb',chance:0.2,type:'item'}]},
    wildpup:      {id:'wildpup', name:'はぐれ子犬', shape:'wolf', palette:MP('#a87848','#222222'), hp:16,atk:7,def:3,mag:0,spd:6,luk:4,exp:5,gold:4, weakness:'ice', drops:[]},
    spider1:      {id:'spider1', name:'どくぐも', shape:'spider', palette:MP('#7a3a9c','#ff5555'), hp:18,atk:8,def:3,mag:0,spd:6,luk:4,exp:6,gold:5, weakness:'fire', drops:[{id:'herb',chance:0.25,type:'item'}]},
    boss_spider:  {id:'boss_spider', name:'だいぐも', shape:'spider', palette:MP('#4a1a6c','#ff0000'), hp:80,atk:15,def:7,mag:2,spd:7,luk:5,exp:45,gold:55, weakness:'fire', isBoss:true, drops:[{id:'w_poisonFang',chance:1.0,type:'equip'}]},

    crab1:        {id:'crab1', name:'いわがに', shape:'golem', palette:MP('#c96a3a','#ffffff'), hp:32,atk:10,def:9,mag:0,spd:3,luk:4,exp:10,gold:8, weakness:'thunder', drops:[{id:'herb',chance:0.2,type:'item'}]},
    seaserpent:   {id:'seaserpent', name:'うみへび', shape:'wolf', palette:MP('#2a7fbf','#ffffff'), hp:28,atk:12,def:5,mag:2,spd:10,luk:5,exp:11,gold:9, weakness:'thunder', drops:[]},
    stormcrow:    {id:'stormcrow', name:'あらしがらす', shape:'bat', palette:MP('#555566','#ffdd00'), hp:24,atk:11,def:4,mag:1,spd:11,luk:6,exp:10,gold:8, weakness:'ice', drops:[{id:'herb',chance:0.15,type:'item'}]},
    ghostsailor:  {id:'ghostsailor', name:'さまよう船乗り', shape:'ghost', palette:MP('#7fa8c9','#222222'), hp:36,atk:13,def:6,mag:4,spd:6,luk:5,exp:13,gold:11, weakness:'fire', drops:[]},
    boss_kraken:  {id:'boss_kraken', name:'こくらーけん', shape:'dragon', palette:MP('#2a4a8c','#ff8800'), hp:150,atk:22,def:11,mag:8,spd:8,luk:6,exp:95,gold:130, weakness:'thunder', isBoss:true, drops:[{id:'ac_seawindGauntlet',chance:1.0,type:'equip'}]},

    snowrabbit:   {id:'snowrabbit', name:'ゆきうさぎ', shape:'slime', palette:MP('#eaf4ff','#3a6ecf'), hp:42,atk:16,def:9,mag:1,spd:11,luk:6,exp:18,gold:15, weakness:'fire', drops:[{id:'hipotion',chance:0.15,type:'item'}]},
    icebat:       {id:'icebat', name:'こおりコウモリ', shape:'bat', palette:MP('#8fd0f0','#222222'), hp:38,atk:17,def:7,mag:3,spd:14,luk:6,exp:18,gold:15, weakness:'fire', drops:[]},
    rockman:      {id:'rockman', name:'がんせきおとこ', shape:'golem', palette:MP('#7a6a5a','#ffffff'), hp:64,atk:20,def:17,mag:0,spd:5,luk:4,exp:24,gold:20, weakness:'fire', drops:[{id:'hipotion',chance:0.15,type:'item'}]},
    skeletonsoldier:{id:'skeletonsoldier', name:'スケルトン兵', shape:'skeleton', palette:skelPal('#d8d4c4','#ff3333'), hp:50,atk:19,def:13,mag:0,spd:9,luk:5,exp:22,gold:19, weakness:'thunder', drops:[]},
    boss_frosttroll:{id:'boss_frosttroll', name:'こおりのトロル', shape:'golem', palette:MP('#b8e0f0','#1a3a6c'), hp:230,atk:31,def:19,mag:4,spd:7,luk:6,exp:170,gold:230, weakness:'fire', isBoss:true, drops:[{id:'w_iceBlade',chance:1.0,type:'equip'}]},

    sandscorpion: {id:'sandscorpion', name:'すなさそり', shape:'spider', palette:MP('#d4b06a','#ff2222'), hp:60,atk:25,def:15,mag:0,spd:12,luk:6,exp:31,gold:28, weakness:'ice', drops:[]},
    mummy:        {id:'mummy', name:'ミイラ', shape:'skeleton', palette:skelPal('#d8c89a','#66ff66'), hp:68,atk:23,def:19,mag:4,spd:6,luk:5,exp:33,gold:30, weakness:'fire', drops:[{id:'hipotion',chance:0.2,type:'item'}]},
    stonesentinel:{id:'stonesentinel', name:'いわゴーレム番兵', shape:'golem', palette:MP('#8a8a92','#4aa8ff'), hp:92,atk:27,def:25,mag:0,spd:4,luk:4,exp:39,gold:37, weakness:'thunder', drops:[]},
    desertfiend:  {id:'desertfiend', name:'さばくの魔人', shape:'imp', palette:MP('#c94a2a','#ffdd00'), hp:74,atk:29,def:16,mag:10,spd:15,luk:6,exp:37,gold:35, weakness:'ice', drops:[{id:'mppotion',chance:0.2,type:'item'}]},
    boss_sandgolem:{id:'boss_sandgolem', name:'すなのきょじん', shape:'golem', palette:MP('#e0c785','#aa3300'), hp:360,atk:39,def:29,mag:6,spd:6,luk:6,exp:270,gold:390, weakness:'thunder', isBoss:true, drops:[{id:'a_earthArmor',chance:1.0,type:'equip'}]},

    darkknight:   {id:'darkknight', name:'あんこくの騎士', shape:'skeleton', palette:skelPal('#2a2a34','#ff2244'), hp:112,atk:41,def:31,mag:6,spd:16,luk:7,exp:71,gold:71, weakness:'thunder', drops:[]},
    demonservant: {id:'demonservant', name:'あくまのつかい', shape:'imp', palette:MP('#4a1a5c','#ffee55'), hp:96,atk:39,def:23,mag:20,spd:19,luk:7,exp:67,gold:66, weakness:'ice', drops:[{id:'hipotion',chance:0.2,type:'item'}]},
    minidragon:   {id:'minidragon', name:'こりゅう', shape:'dragon', palette:MP('#6a2a8c','#ffee00'), hp:152,atk:45,def:27,mag:14,spd:17,luk:7,exp:91,gold:96, weakness:'ice', drops:[]},
    phantomarmy:  {id:'phantomarmy', name:'げんえいそう', shape:'ghost', palette:MP('#2a2a3a','#ff3333'), hp:122,atk:43,def:25,mag:22,spd:21,luk:8,exp:81,gold:81, weakness:'fire', drops:[{id:'elixir',chance:0.1,type:'item'}]},
    boss_maou:    {id:'boss_maou', name:'魔王ヴァルガイン', shape:'dragon', palette:MP('#1a0a0a','#ff0000'), hp:950,atk:60,def:37,mag:40,spd:23,luk:8,exp:0,gold:0, weakness:null, isBoss:true, finalBoss:true, drops:[]},

    directwraith: {id:'directwraith', name:'ネームレス', shape:'ghost', palette:MP('#111111','#ff00ff'), hp:260,atk:65,def:40,mag:35,spd:26,luk:9,exp:220,gold:260, weakness:null, drops:[{id:'elixir',chance:0.3,type:'item'}]},
    eliteknight:  {id:'eliteknight', name:'えいゆうの残骸', shape:'skeleton', palette:skelPal('#3a3a44','#00ffff'), hp:300,atk:70,def:48,mag:10,spd:24,luk:9,exp:240,gold:280, weakness:null, drops:[]},
    boss_ancientdragon:{id:'boss_ancientdragon', name:'古竜ダークガイア', shape:'dragon', palette:MP('#0a0a0a','#ff0000'), hp:1500,atk:78,def:50,mag:50,spd:30,luk:10,exp:600,gold:1200, weakness:null, isBoss:true, drops:[{id:'w_maouSword',chance:1.0,type:'equip'},{id:'ac_chaosOrb',chance:0.5,type:'equip'}]}
  };

  // ===== ショップ =====
  const SHOPS = {
    shop_town1: {items:['herb','hipotion','mppotion'], equip:['w_woodsword','a_clothrobe','ac_powerarm','ac_speedboots']},
    shop_town2: {items:['herb','hipotion','mppotion','elixir'], equip:['w_ironsword','a_leather','ac_magring','ac_guardcharm']},
    shop_town3: {items:['herb','hipotion','mppotion','elixir'], equip:['w_mithsword','a_chain','ac_speedboots','ac_guardcharm']},
    shop_town4: {items:['hipotion','mppotion','elixir'], equip:['w_steelgreat','a_ironarmor','ac_magring','ac_powerarm']},
    shop_town5: {items:['hipotion','mppotion','elixir'], equip:['w_lightblade','a_mithArmor','ac_guardcharm','ac_magring']},
    shop_hidden:{items:['elixir'], equip:['a_legendArmor','ac_dragonscale'], visibleIf:(f)=>f.postgame}
  };

  // ===== 町NPC生成ヘルパー =====
  const SLOT_XY = {shop:{x:3,y:2}, inn:{x:7,y:2}, flavor1:{x:2,y:5}, flavor2:{x:8,y:5}, quest:{x:5,y:3}};
  function buildTownNpcs(cfg){
    const npcs = [];
    npcs.push(Object.assign({}, SLOT_XY.shop, {name:cfg.shopName||'店主', hair:'#3a2a1a', cloth:'#c9a23a', shopId:cfg.shopId, dialogue:['いらっしゃい!何か見ていくかい?']}));
    npcs.push(Object.assign({}, SLOT_XY.inn, {name:cfg.innName||'宿屋の主人', hair:'#8a5a3a', cloth:'#c94a6a', innHeal:true, dialogue:['ゆっくり休んでいきなよ。']}));
    (cfg.npcs||[]).forEach(n=>{
      const xy = SLOT_XY[n.slot];
      npcs.push(Object.assign({}, xy, {name:n.name, hair:n.hair, cloth:n.cloth, dialogue:n.lines}));
    });
    return npcs;
  }

  function townGrid(){
    const g = MG.newGrid(11,9,'W');
    MG.rect(g,1,1,9,7,'F');
    g[8][5] = 'F';
    return g;
  }

  const TOWN_CONFIGS = [
    {id:'town1', name:'はじまりの村', shopId:'shop_town1', bgMusic:'town',
     npcs:[
       {slot:'flavor1', name:'村長', hair:'#e8d8b8', cloth:'#6a8a4a', lines:['勇者様、ついに来てくれたんじゃな!','この先の森に魔物の親玉が出るという。気をつけて。']},
       {slot:'flavor2', name:'村の子ども', hair:'#3a2a1a', cloth:'#c94a4a', lines:['ねえねえ、ほんとに魔王をたおすの?','ぼくも大きくなったら勇者になるんだ!']},
       {slot:'quest', name:'物知り村人', hair:'#e8e8e8', cloth:'#6a4a8a', lines:['南の森に大きな洞窟があってな。','大きなクモが住みついとるという噂じゃ…。']}
     ]},
    {id:'town2', name:'潮風の港町', shopId:'shop_town2', bgMusic:'town',
     npcs:[
       {slot:'flavor1', name:'漁師', hair:'#5a3a1a', cloth:'#3a6a8a', lines:['最近、灯台のあたりで変な光が見えるんだ。','海の底から何かが来てるって噂もある。']},
       {slot:'flavor2', name:'港の少女', hair:'#e0a23a', cloth:'#4a8ac9', lines:['勇者さん、海はきれいでしょう?','でも灯台には近づかないほうがいいよ…。']},
       {slot:'quest', name:'灯台守の娘', hair:'#c94a6a', cloth:'#e8e8e8', lines:['父が灯台の見回りに行ったまま戻らないの。','お願い、様子を見てきてください。']}
     ]},
    {id:'town3', name:'霧氷の山あい町', shopId:'shop_town3', bgMusic:'town',
     npcs:[
       {slot:'flavor1', name:'猟師', hair:'#3a3a3a', cloth:'#8a4a2a', lines:['山の奥は吹雪がひどくてな。','雪山の洞窟には近づかんほうがいい。']},
       {slot:'flavor2', name:'旅の商人', hair:'#8a5a3a', cloth:'#4a4a6a', lines:['寒いところは苦手でねえ。','でも品揃えには自信があるよ!']},
       {slot:'quest', name:'村の巫女', hair:'#e8e8f0', cloth:'#c94a8a', lines:['雪山の奥に、氷の化け物が棲みついています。','どうか、村を守ってください。']}
     ]},
    {id:'town4', name:'砂塵の隊商町', shopId:'shop_town4', bgMusic:'town',
     npcs:[
       {slot:'flavor1', name:'隊商のあるじ', hair:'#2a2a2a', cloth:'#c9a23a', lines:['砂漠のさらに奥に古代遺跡があってな。','宝もあるらしいが、化け物もいるぞ。']},
       {slot:'flavor2', name:'砂漠の子ども', hair:'#5a3a1a', cloth:'#e0c785', lines:['暑いけど、ぼくはこの町がすきだよ。','勇者さん、遺跡には気をつけてね!']},
       {slot:'quest', name:'考古学者', hair:'#8a8a8a', cloth:'#3a6a4a', lines:['あの遺跡には、大きな守護者がいるという記録が…。','調査のためにも、どうか調べてきてほしい。']}
     ]},
    {id:'town5', name:'王都グランディア', shopId:'shop_town5', bgMusic:'town',
     npcs:[
       {slot:'flavor1', name:'衛兵', hair:'#2a2a2a', cloth:'#4a4a6a', lines:['ここまで来るとは、大したものだ。','この先、魔王城には気をつけて行け。']},
       {slot:'flavor2', name:'王女', hair:'#e0a23a', cloth:'#d6488f', lines:['勇者よ、この国の未来はあなたにかかっています。','どうか、力を貸してください。']},
       {slot:'quest', name:'宮廷魔導士', hair:'#e8e8e8', cloth:'#4a2a8a', lines:['魔王ヴァルガインは、かつて人であったとも言われる。','真実がどうであれ、今は止めるしかない。']}
     ]}
  ];

  // ===== ダンジョン生成ヘルパー =====
  function buildDungeon(w,h,wallTile,floorTile){
    const g = MG.newGrid(w,h,wallTile);
    const midx = Math.floor(w/2);
    MG.rect(g, midx-1, 1, midx+1, h-1, floorTile);
    MG.rect(g, 1, 0, w-2, 3, floorTile);
    MG.rect(g, 1, h-8, midx-2, h-6, floorTile);
    return {grid:g, midx, chest:{x:2,y:h-7}};
  }

  const DUNGEON_CONFIGS = [
    {id:'d1', name:'森の洞窟', wallTile:'T', floorTile:'C', h:22, bossId:'boss_spider', flag:'d1clear',
     table:[{id:'spider1',w:4},{id:'bat1',w:3},{id:'wildpup',w:3}], chestEquip:null, chestItem:'hipotion'},
    {id:'d2', name:'灯台', wallTile:'W', floorTile:'F', h:22, bossId:'boss_kraken', flag:'d2clear',
     table:[{id:'ghostsailor',w:4},{id:'seaserpent',w:3},{id:'crab1',w:3}], chestEquip:null, chestItem:'mppotion'},
    {id:'d3', name:'雪山洞窟', wallTile:'^', floorTile:'C', h:24, bossId:'boss_frosttroll', flag:'d3clear',
     table:[{id:'skeletonsoldier',w:4},{id:'icebat',w:3},{id:'rockman',w:3}], chestEquip:'ac_guardcharm', chestItem:null},
    {id:'d4', name:'古代遺跡', wallTile:'W', floorTile:'S', h:24, bossId:'boss_sandgolem', flag:'d4clear',
     table:[{id:'desertfiend',w:4},{id:'mummy',w:3},{id:'sandscorpion',w:3}], chestEquip:'ac_magring', chestItem:null},
    {id:'d5', name:'魔王城', wallTile:'W', floorTile:'F', h:26, bossId:'boss_maou', flag:'d5clear',
     table:[{id:'phantomarmy',w:4},{id:'darkknight',w:3},{id:'minidragon',w:3}], chestEquip:'ac_dragonscale', chestItem:null},
    {id:'hidden', name:'忘却の隠しダンジョン', wallTile:'W', floorTile:'C', h:20, bossId:'boss_ancientdragon', flag:'hiddenClear',
     table:[{id:'directwraith',w:5},{id:'eliteknight',w:5}], chestEquip:'a_legendArmor', chestItem:'elixir'}
  ];
  const DUNGEONS = {};
  DUNGEON_CONFIGS.forEach(cfg=>{
    const built = buildDungeon(9, cfg.h, cfg.wallTile, cfg.floorTile);
    DUNGEONS[cfg.id] = Object.assign({}, cfg, {
      grid: built.grid,
      entrance: {x:built.midx, y:cfg.h-1},
      bossZone: {x0:1,y0:0,x1:7,y1:3},
      bossTriggerCenter: {x:built.midx, y:1},
      chestPos: built.chest
    });
  });

  // ===== ワールドマップ =====
  const WORLD_W = 12, WORLD_H = 40;
  const worldGrid = MG.newGrid(WORLD_W, WORLD_H, '.');
  function sideBlock(y0,y1,ch){ MG.rect(worldGrid,0,y0,1,y1,ch); MG.rect(worldGrid,10,y0,11,y1,ch); }
  sideBlock(0,7,'T');
  sideBlock(8,15,'~');
  sideBlock(16,23,'^');
  sideBlock(24,31,'^');
  sideBlock(32,39,'W');
  MG.rect(worldGrid,0,0,11,0,'T');
  MG.rect(worldGrid,0,39,4,39,'W');
  MG.rect(worldGrid,6,39,11,39,'W');
  MG.rect(worldGrid,2,9,3,11,'~');
  MG.rect(worldGrid,2,20,9,23,'N');
  MG.rect(worldGrid,2,24,9,31,'S');
  MG.rect(worldGrid,2,37,9,39,'F');
  function boundaryWall(y, ch){ MG.rect(worldGrid,2,y,9,y,ch); worldGrid[y][5]='.'; }
  boundaryWall(8,'T');
  boundaryWall(16,'^');
  boundaryWall(24,'^');
  boundaryWall(32,'W');
  [[3,6],[7,6],[3,5],[8,2],[8,5]].forEach(([x,y])=>{ worldGrid[y][x]='T'; });

  const WORLD_ENTRANCES = [
    {x:5,y:3,  target:'town1',  spawn:{x:5,y:7}},
    {x:5,y:7,  target:'d1',     spawn:null},
    {x:5,y:11, target:'town2',  spawn:{x:5,y:7}},
    {x:5,y:14, target:'d2',     spawn:null},
    {x:5,y:19, target:'town3',  spawn:{x:5,y:7}},
    {x:5,y:22, target:'d3',     spawn:null},
    {x:5,y:27, target:'town4',  spawn:{x:5,y:7}},
    {x:5,y:30, target:'d4',     spawn:null},
    {x:5,y:35, target:'town5',  spawn:{x:5,y:7}},
    {x:5,y:39, target:'d5',     spawn:null},
    {x:2,y:3,  target:'hidden', spawn:null}
  ];
  const TOWN_RETURN = { town1:{x:5,y:4}, town2:{x:5,y:12}, town3:{x:5,y:20}, town4:{x:5,y:28}, town5:{x:5,y:36} };
  const DUNGEON_RETURN = { d1:{x:5,y:6}, d2:{x:5,y:13}, d3:{x:5,y:21}, d4:{x:5,y:29}, d5:{x:5,y:38}, hidden:{x:2,y:2} };

  const WORLD_GUARDS = [
    {x:5,y:8,  hair:'#222222', cloth:'#4a4a5a', name:'見張り番', visibleIf:(f)=>!f.d1clear, dialogue:['森の洞窟のヌシを倒すまでは、この先には行かせられん。']},
    {x:5,y:16, hair:'#222222', cloth:'#4a4a5a', name:'見張り番', visibleIf:(f)=>!f.d2clear, dialogue:['灯台の異変を解決するまでは、山には行かせられん。']},
    {x:5,y:24, hair:'#222222', cloth:'#4a4a5a', name:'見張り番', visibleIf:(f)=>!f.d3clear, dialogue:['雪山の氷の化け物を倒すまでは、砂漠には行かせられん。']},
    {x:5,y:32, hair:'#222222', cloth:'#4a4a5a', name:'見張り番', visibleIf:(f)=>!f.d4clear, dialogue:['遺跡の守護者を倒すまでは、王都には行かせられん。']},
    {x:2,y:3,  hair:'#5a4a3a', cloth:'#6a6a6a', name:'不思議な岩', visibleIf:(f)=>!f.postgame, dialogue:['この岩、なんだか気になるが…びくともしない。']}
  ];

  const WORLD_BANDS = [
    {y0:0,  y1:7,  bg:'field', table:[{id:'slime',w:4},{id:'bat1',w:3},{id:'wildpup',w:3}]},
    {y0:8,  y1:15, bg:'field', table:[{id:'crab1',w:4},{id:'seaserpent',w:3},{id:'stormcrow',w:3}]},
    {y0:16, y1:23, bg:'field', table:[{id:'snowrabbit',w:4},{id:'icebat',w:3},{id:'rockman',w:3}]},
    {y0:24, y1:31, bg:'field', table:[{id:'sandscorpion',w:4},{id:'mummy',w:3},{id:'stonesentinel',w:3}]},
    {y0:32, y1:39, bg:'field', table:[{id:'darkknight',w:4},{id:'demonservant',w:3},{id:'minidragon',w:3}]}
  ];
  function encounterTableForWorldY(y){
    for(const b of WORLD_BANDS){ if(y>=b.y0 && y<=b.y1) return b.table; }
    return WORLD_BANDS[0].table;
  }

  // ===== ストーリーテキスト =====
  const STORY = {
    intro: [
      'それは、平和だったはずの世界に、\n魔王ヴァルガインが現れたある日のこと。',
      '各地の魔物たちが暴れ出し、\n人々は静かな恐怖に包まれていた。',
      'そんな中、はじまりの村に住む\nひとりの若者が、剣を手に取った。',
      '「…よし、勇者、はじめました。」'
    ],
    bossIntro: {
      boss_spider:['ザザザザ…!暗闇から巨大な影が…!','だいぐもが現れた!'],
      boss_kraken:['灯台の下の海面が、大きく盛り上がる…!','こくらーけんが襲いかかってきた!'],
      boss_frosttroll:['冷気とともに、氷の巨体が立ちはだかる…!','こおりのトロルが唸り声をあげた!'],
      boss_sandgolem:['砂が渦を巻き、巨大な人型が組み上がっていく…!','すなのきょじんが目覚めた!'],
      boss_maou:['玉座から、圧倒的な気配が立ち上る…。','「よくぞここまで来た、小さき勇者よ。」','魔王ヴァルガインとの最終決戦がはじまる!'],
      boss_ancientdragon:['封じられていた扉の奥から、古の咆哮が響く…。','古竜ダークガイアが目を覚ました!']
    },
    bossVictoryExtra: {
      boss_maou: ['魔王ヴァルガインの体が、光の粒子となって崩れていく…。','「……悪くない、旅だったよ。」']
    },
    ending: [
      '魔王ヴァルガインを倒し、\n世界に静かな朝が戻ってきた。',
      '「ふう…やっと終わった。」',
      '勇者は剣をおさめ、\nもと来た道をゆっくりと歩き出す。',
      'けれど、旅の記憶はまだ終わらない。\nどこかに、まだ見ぬ力が眠っているという噂も…。',
      '- THE END -\n(つづける を選ぶと、冒険をつづけられます)'
    ],
    hiddenUnlock: [
      '世界に平和が戻った…はずだった。',
      'しかし、どこか遠くで、古い扉が軋む音がする。',
      'まだ、旅は終わっていないのかもしれない。'
    ]
  };

  global.GameData = {
    ELEMENTS, ELEMENT_NAME, elementMultiplier,
    MAX_LEVEL, EXP_TABLE, levelForExp, expToNextLevel,
    BASE_STATS, GROWTH, statsAtLevel,
    GENDER_PRESETS, SKILLS, skillsKnownAtLevel,
    ITEMS, getItem, EQUIPMENT, getEquip,
    MONSTERS, SHOPS,
    TOWN_CONFIGS, townGrid, buildTownNpcs,
    DUNGEONS,
    worldGrid, WORLD_W, WORLD_H, WORLD_ENTRANCES, TOWN_RETURN, DUNGEON_RETURN, WORLD_GUARDS,
    encounterTableForWorldY,
    STORY
  };
})(window);
