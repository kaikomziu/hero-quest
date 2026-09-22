// マップ用グリッド構築ヘルパー(地形をテキストではなく矩形操作で組み立てる)
(function(global){
  "use strict";

  function newGrid(w, h, fill){
    const g = [];
    for(let y=0;y<h;y++){ g.push(new Array(w).fill(fill)); }
    g.w = w; g.h = h;
    return g;
  }
  function rect(g, x0, y0, x1, y1, ch){
    for(let y=Math.max(0,y0); y<=Math.min(g.h-1,y1); y++){
      for(let x=Math.max(0,x0); x<=Math.min(g.w-1,x1); x++){ g[y][x]=ch; }
    }
  }
  function border(g, ch){
    rect(g,0,0,g.w-1,0,ch);
    rect(g,0,g.h-1,g.w-1,g.h-1,ch);
    rect(g,0,0,0,g.h-1,ch);
    rect(g,g.w-1,0,g.w-1,g.h-1,ch);
  }
  function hline(g, y, x0, x1, ch){ rect(g,x0,y,x1,y,ch); }
  function vline(g, x, y0, y1, ch){ rect(g,x,y0,x,y1,ch); }
  function point(g, x, y, ch){ if(y>=0&&y<g.h&&x>=0&&x<g.w) g[y][x]=ch; }
  function get(g, x, y){ if(y<0||y>=g.h||x<0||x>=g.w) return null; return g[y][x]; }

  // 決定的な疑似乱数(シード固定でマップ生成のたびに同じ結果にする)
  function makeRng(seed){
    let s = seed >>> 0;
    return function(){
      s = (s*1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function scatter(g, ch, density, seed, avoid){
    const rng = makeRng(seed);
    avoid = avoid || (()=>false);
    for(let y=0;y<g.h;y++){
      for(let x=0;x<g.w;x++){
        if(avoid(x,y)) continue;
        if(rng() < density) g[y][x] = ch;
      }
    }
  }
  function toRows(g){
    return g.map(row => row.join(''));
  }

  global.MapGen = { newGrid, rect, border, hline, vline, point, get, makeRng, scatter, toRows };
})(window);
