// RPGツクール風ウィンドウ・テキストボックス・メニューのUI部品
(function(global){
  "use strict";

  const COL = {
    outer:'#f0f4ff', inner:'#4a5aa8', fillTop:'#232c56', fillBottom:'#131936',
    text:'#f4f4f8', accent:'#ffce54', hp:'#ff5566', hpBg:'#4a1a22',
    mp:'#4fa8ff', mpBg:'#1a2a4a', exp:'#6ee06e', dim:'#9aa2c8'
  };

  function drawWindow(ctx, x, y, w, h, opts){
    opts = opts || {};
    ctx.save();
    const grad = ctx.createLinearGradient(0,y,0,y+h);
    grad.addColorStop(0, COL.fillTop);
    grad.addColorStop(1, COL.fillBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = COL.inner;
    ctx.lineWidth = 3;
    ctx.strokeRect(x+3,y+3,w-6,h-6);
    ctx.strokeStyle = opts.accent ? COL.accent : COL.outer;
    ctx.lineWidth = 2;
    ctx.strokeRect(x+1,y+1,w-2,h-2);
    ctx.restore();
  }

  function wrapByWidth(ctx, text, maxWidth, font){
    ctx.save();
    ctx.font = font;
    const out = [];
    text.split('\n').forEach(paragraph=>{
      let line = '';
      for(const ch of paragraph){
        const test = line + ch;
        if(ctx.measureText(test).width > maxWidth && line.length>0){
          out.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      out.push(line);
    });
    ctx.restore();
    return out;
  }

  function drawBar(ctx, x, y, w, h, ratio, fillColor, bgColor){
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = bgColor;
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle = fillColor;
    ctx.fillRect(x,y,Math.round(w*ratio),h);
    ctx.strokeStyle = COL.outer;
    ctx.lineWidth = 1;
    ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
  }

  // ---- タイプライター式ダイアログ ----
  function Dialogue(pages, opts){
    this.pages = pages;
    this.opts = opts || {};
    this.pageIndex = 0;
    this.charTimer = 0;
    this.revealChars = 0;
    this.speed = this.opts.speed || 36; // 1秒あたりの文字数
    this.done = false;
  }
  Dialogue.prototype.currentText = function(){ return this.pages[this.pageIndex] || ''; };
  Dialogue.prototype.update = function(dt){
    const text = this.currentText();
    if(this.revealChars < text.length){
      this.charTimer += dt;
      const step = 1/this.speed;
      while(this.charTimer >= step && this.revealChars < text.length){
        this.charTimer -= step;
        this.revealChars++;
      }
    }
  };
  Dialogue.prototype.isPageRevealed = function(){ return this.revealChars >= this.currentText().length; };
  Dialogue.prototype.confirm = function(){
    if(!this.isPageRevealed()){ this.revealChars = this.currentText().length; return false; }
    if(this.pageIndex < this.pages.length-1){ this.pageIndex++; this.revealChars=0; this.charTimer=0; return false; }
    this.done = true;
    return true;
  };

  const CONTROL_RESERVE = 112; // 画面下部の十字キー・ボタン領域と重ならないための余白

  function drawDialogueBox(ctx, W, H, dialogue, nameLabel){
    const boxH = 92;
    drawDialogueBoxAt(ctx, 10, H-CONTROL_RESERVE-boxH, W-20, boxH, dialogue, nameLabel);
  }

  function drawDialogueBoxAt(ctx, x, y, w, h, dialogue, nameLabel){
    drawWindow(ctx, x, y, w, h);
    ctx.save();
    ctx.fillStyle = COL.text;
    const font = '13px sans-serif';
    ctx.font = font;
    ctx.textBaseline = 'top';
    let textY = y+14;
    if(nameLabel){
      ctx.fillStyle = COL.accent;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(nameLabel, x+14, y+8);
      textY = y+26;
      ctx.font = font;
      ctx.fillStyle = COL.text;
    }
    const full = dialogue.currentText();
    const shown = full.slice(0, dialogue.revealChars);
    const lines = wrapByWidth(ctx, shown, w-28, font);
    lines.slice(0,3).forEach((line,i)=>{ ctx.fillText(line, x+14, textY+i*18); });
    if(dialogue.isPageRevealed()){
      const blink = Math.floor(performance.now()/400)%2===0;
      if(blink){
        ctx.fillStyle = COL.accent;
        ctx.beginPath();
        ctx.moveTo(x+w-20, y+h-16);
        ctx.lineTo(x+w-12, y+h-16);
        ctx.lineTo(x+w-16, y+h-10);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ---- メニュー ----
  function Menu(items, opts){
    this.items = items;
    this.opts = opts || {};
    this.cursor = 0;
    this.cols = this.opts.cols || 1;
  }
  Menu.prototype.move = function(dir){
    const n = this.items.length;
    if(n===0) return;
    if(this.cols===1){
      if(dir==='up') this.cursor = (this.cursor-1+n)%n;
      if(dir==='down') this.cursor = (this.cursor+1)%n;
    } else {
      const cols = this.cols;
      if(dir==='left') this.cursor = Math.max(0, this.cursor-1);
      if(dir==='right') this.cursor = Math.min(n-1, this.cursor+1);
      if(dir==='up') this.cursor = Math.max(0, this.cursor-cols);
      if(dir==='down') this.cursor = Math.min(n-1, this.cursor+cols);
    }
  };
  Menu.prototype.selected = function(){ return this.items[this.cursor]; };

  function drawMenu(ctx, x, y, w, h, menu, opts){
    opts = opts || {};
    drawWindow(ctx, x, y, w, h);
    ctx.save();
    ctx.font = opts.font || '13px sans-serif';
    ctx.textBaseline = 'top';
    const rowH = opts.rowH || 22;
    const padX = 14, padY = 12;
    const cols = menu.cols || 1;
    const totalRows = Math.ceil(menu.items.length/cols);
    const maxRows = Math.max(1, Math.floor((h-padY*2)/rowH));
    const cursorRow = Math.floor(menu.cursor/cols);
    let scrollRow = 0;
    if(totalRows>maxRows){
      scrollRow = Math.min(Math.max(0, cursorRow-Math.floor(maxRows/2)), totalRows-maxRows);
    }
    const firstIdx = scrollRow*cols;
    const lastIdx = Math.min(menu.items.length, firstIdx+maxRows*cols);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for(let i=firstIdx;i<lastIdx;i++){
      const item = menu.items[i];
      const row = (cols>1 ? Math.floor(i/cols) : i) - scrollRow;
      const col = cols>1 ? i%cols : 0;
      const colW = (w-padX*2)/cols;
      const ix = x+padX+col*colW;
      const iy = y+padY+row*rowH;
      if(i===menu.cursor){
        ctx.fillStyle = 'rgba(255,206,84,0.18)';
        ctx.fillRect(x+4, iy-2, w-8, rowH-2);
        ctx.fillStyle = COL.accent;
        ctx.fillText('▶', ix-2, iy);
      }
      ctx.fillStyle = item.disabled ? COL.dim : COL.text;
      ctx.fillText(item.label, ix+14, iy);
      if(item.rightLabel){
        ctx.textAlign = 'right';
        ctx.fillText(item.rightLabel, ix+colW-10, iy);
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();
    if(totalRows>maxRows){
      ctx.fillStyle = COL.dim;
      ctx.textAlign = 'center';
      if(scrollRow>0) ctx.fillText('▲', x+w-14, y+4);
      if(scrollRow+maxRows<totalRows) ctx.fillText('▼', x+w-14, y+h-16);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  global.UI = { COL, CONTROL_RESERVE, drawWindow, wrapByWidth, drawBar, Dialogue, drawDialogueBox, drawDialogueBoxAt, Menu, drawMenu };
})(window);
