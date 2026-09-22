// Web Audio APIだけで合成するチップチューンBGM/効果音
(function(global){
  "use strict";

  let ctx = null;
  let masterGain = null;
  let bgmGain = null;
  let sfxGain = null;
  let currentTrackName = null;
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let noteIndex = 0;
  let muted = false;

  const NOTE_FREQ = {};
  (function buildNoteTable(){
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for(let oct=1; oct<=7; oct++){
      names.forEach((n,i)=>{
        const midi = (oct+1)*12 + i;
        const freq = 440 * Math.pow(2, (midi-69)/12);
        NOTE_FREQ[n+oct] = freq;
      });
    }
  })();
  function freqOf(note){
    if(!note) return null;
    return NOTE_FREQ[note] || null;
  }

  function ensureCtx(){
    if(ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.55; masterGain.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.85; bgmGain.connect(masterGain);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(masterGain);
  }

  function playTone(freq, startTime, dur, opts){
    opts = opts || {};
    const type = opts.type || 'square';
    const gainNode = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    const peak = opts.vol!==undefined?opts.vol:0.22;
    const attack = opts.attack!==undefined?opts.attack:0.01;
    const release = opts.release!==undefined?opts.release:0.06;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peak, startTime+attack);
    gainNode.gain.setValueAtTime(peak, Math.max(startTime+attack, startTime+dur-release));
    gainNode.gain.linearRampToValueAtTime(0, startTime+dur);
    osc.connect(gainNode);
    gainNode.connect(opts.dest || bgmGain);
    osc.start(startTime);
    osc.stop(startTime+dur+0.02);
  }

  function playNoise(startTime, dur, opts){
    opts = opts || {};
    const bufSize = ctx.sampleRate*dur;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i] = (Math.random()*2-1) * (1-i/bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gainNode = ctx.createGain();
    gainNode.gain.value = opts.vol!==undefined?opts.vol:0.3;
    src.connect(gainNode);
    gainNode.connect(opts.dest || sfxGain);
    src.start(startTime);
  }

  // トラック定義: melody/bass は [note, beats] の配列。noteはnullで休符
  const TRACKS = {
    title: {tempo:108, type:'square', bassType:'triangle',
      melody:[['E4',1],['G4',1],['B4',1],['E5',1],['D5',1],['B4',1],['G4',1],['D5',1],
              ['C5',1],['E5',1],['G5',1],['C6',1],['B5',1],['G5',1],['E5',1],['B4',2]],
      bass:[['C3',2],['G2',2],['A2',2],['E2',2],['F2',2],['C2',2],['G2',2],['G2',2]]
    },
    field: {tempo:132, type:'square', bassType:'triangle',
      melody:[['C5',1],['E5',1],['G5',1],['E5',1],['A4',1],['C5',1],['E5',1],['C5',1],
              ['D5',1],['F5',1],['A5',1],['F5',1],['G4',1],['C5',1],['E5',1],['G4',1]],
      bass:[['C3',1],['C3',1],['A2',1],['A2',1],['F2',1],['F2',1],['G2',1],['G2',1],
            ['C3',1],['C3',1],['A2',1],['A2',1],['F2',1],['G2',1],['C3',2]]
    },
    town: {tempo:100, type:'triangle', bassType:'sine',
      melody:[['G4',1],['B4',1],['D5',1],['B4',1],['C5',1],['E5',1],['G5',1],['E5',1],
              ['A4',1],['C5',1],['E5',1],['C5',1],['D5',1],['G4',1],['B4',1],['D5',2]],
      bass:[['C3',2],['G2',2],['A2',2],['E2',2],['F2',2],['G2',2],['C3',2],['C3',2]]
    },
    dungeon: {tempo:96, type:'sawtooth', bassType:'triangle',
      melody:[['D4',1],['F4',1],['D4',1],['A3',1],['D4',1],['F4',1],['G4',1],['F4',1],
              ['C4',1],['D4',1],['E4',1],['D4',1],['A3',1],['C4',1],['D4',2]],
      bass:[['D2',2],['D2',2],['A1',2],['A1',2],['C2',2],['C2',2],['D2',2],['D2',2]]
    },
    battle: {tempo:150, type:'square', bassType:'square',
      melody:[['E4',0.5],['E4',0.5],['G4',0.5],['E4',0.5],['D4',0.5],['D4',0.5],['F4',0.5],['D4',0.5],
              ['C4',0.5],['C4',0.5],['E4',0.5],['G4',0.5],['A4',0.5],['G4',0.5],['E4',0.5],['D4',0.5],
              ['E4',0.5],['G4',0.5],['B4',0.5],['G4',0.5],['A4',0.5],['C5',0.5],['B4',0.5],['G4',0.5],
              ['E4',1],['D4',1],['C4',2]],
      bass:[['A2',0.5],['A2',0.5],['A2',0.5],['A2',0.5],['D2',0.5],['D2',0.5],['D2',0.5],['D2',0.5],
            ['C2',0.5],['C2',0.5],['C2',0.5],['C2',0.5],['E2',0.5],['E2',0.5],['E2',0.5],['E2',0.5],
            ['A2',0.5],['A2',0.5],['A2',0.5],['A2',0.5],['F2',0.5],['F2',0.5],['F2',0.5],['F2',0.5],
            ['A2',1],['G2',1],['A2',2]]
    },
    boss: {tempo:160, type:'sawtooth', bassType:'square',
      melody:[['A3',0.5],['C4',0.5],['E4',0.5],['A4',0.5],['G4',0.5],['E4',0.5],['C4',0.5],['A3',0.5],
              ['F3',0.5],['A3',0.5],['C4',0.5],['F4',0.5],['E4',0.5],['C4',0.5],['A3',0.5],['F3',0.5],
              ['G3',0.5],['B3',0.5],['D4',0.5],['G4',0.5],['F4',0.5],['D4',0.5],['B3',0.5],['G3',0.5],
              ['A3',1],['A3',1],['A2',2]],
      bass:[['A1',0.5],['A1',0.5],['A1',0.5],['A1',0.5],['F1',0.5],['F1',0.5],['F1',0.5],['F1',0.5],
            ['G1',0.5],['G1',0.5],['G1',0.5],['G1',0.5],['E1',0.5],['E1',0.5],['E1',0.5],['E1',0.5],
            ['A1',0.5],['A1',0.5],['A1',0.5],['A1',0.5],['D1',0.5],['D1',0.5],['D1',0.5],['D1',0.5],
            ['A1',1],['A1',1],['A1',2]]
    }
  };

  function beatSeconds(tempo){ return 60/tempo; }

  function scheduleTrack(){
    if(!currentTrackName) return;
    const t = TRACKS[currentTrackName];
    if(!t) return;
    const bs = beatSeconds(t.tempo);
    const lookahead = 0.2;
    while(nextNoteTime < ctx.currentTime + lookahead){
      const mi = noteIndex % t.melody.length;
      const bi = noteIndex % t.bass.length;
      const [mNote, mBeats] = t.melody[mi];
      const [bNote, bBeats] = t.bass[bi];
      const mf = freqOf(mNote);
      const bf = freqOf(bNote);
      if(mf) playTone(mf, nextNoteTime, mBeats*bs*0.92, {type:t.type, vol:0.16, dest:bgmGain});
      if(bf) playTone(bf, nextNoteTime, bBeats*bs*0.95, {type:t.bassType, vol:0.14, dest:bgmGain});
      nextNoteTime += mBeats*bs;
      noteIndex++;
    }
  }

  function playBGM(name){
    ensureCtx();
    if(ctx.state === 'suspended') ctx.resume();
    if(currentTrackName === name) return;
    currentTrackName = name;
    noteIndex = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    if(schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = setInterval(scheduleTrack, 60);
  }
  function stopBGM(){
    currentTrackName = null;
    if(schedulerTimer){ clearInterval(schedulerTimer); schedulerTimer = null; }
  }

  const SFX = {
    cursor(){ ensureCtx(); playTone(880, ctx.currentTime, 0.05, {type:'square', vol:0.15, dest:sfxGain}); },
    confirm(){ ensureCtx(); const t=ctx.currentTime; playTone(660,t,0.06,{type:'square',vol:0.18,dest:sfxGain}); playTone(990,t+0.05,0.08,{type:'square',vol:0.18,dest:sfxGain}); },
    cancel(){ ensureCtx(); playTone(440, ctx.currentTime, 0.08, {type:'square', vol:0.15, dest:sfxGain}); },
    attack(){ ensureCtx(); const t=ctx.currentTime; playNoise(t,0.08,{vol:0.25}); playTone(180,t,0.1,{type:'sawtooth',vol:0.2,dest:sfxGain}); },
    hit(){ ensureCtx(); const t=ctx.currentTime; playTone(120,t,0.12,{type:'square',vol:0.25,dest:sfxGain}); },
    magic(){ ensureCtx(); const t=ctx.currentTime; [660,880,1100,1320].forEach((f,i)=>playTone(f,t+i*0.04,0.1,{type:'sine',vol:0.16,dest:sfxGain})); },
    heal(){ ensureCtx(); const t=ctx.currentTime; [523,659,784,1046].forEach((f,i)=>playTone(f,t+i*0.06,0.14,{type:'triangle',vol:0.18,dest:sfxGain})); },
    levelup(){ ensureCtx(); const t=ctx.currentTime; [523,659,784,1046,1318].forEach((f,i)=>playTone(f,t+i*0.09,0.16,{type:'square',vol:0.2,dest:sfxGain})); },
    victory(){ ensureCtx(); const t=ctx.currentTime; [523,523,523,659,784,1046].forEach((f,i)=>playTone(f,t+i*0.14,0.18,{type:'square',vol:0.2,dest:sfxGain})); },
    gameover(){ ensureCtx(); const t=ctx.currentTime; [440,392,349,293].forEach((f,i)=>playTone(f,t+i*0.22,0.3,{type:'sawtooth',vol:0.2,dest:sfxGain})); },
    step(){ ensureCtx(); playNoise(ctx.currentTime, 0.03, {vol:0.06}); },
    open(){ ensureCtx(); const t=ctx.currentTime; playTone(392,t,0.08,{type:'square',vol:0.16,dest:sfxGain}); playTone(523,t+0.08,0.1,{type:'square',vol:0.16,dest:sfxGain}); },
    buy(){ ensureCtx(); const t=ctx.currentTime; playTone(784,t,0.05,{type:'square',vol:0.16,dest:sfxGain}); playTone(1046,t+0.05,0.08,{type:'square',vol:0.16,dest:sfxGain}); },
    run(){ ensureCtx(); const t=ctx.currentTime; playTone(300,t,0.06,{type:'square',vol:0.14,dest:sfxGain}); playTone(200,t+0.06,0.08,{type:'square',vol:0.14,dest:sfxGain}); },
  };

  function setMuted(v){
    muted = v;
    ensureCtx();
    masterGain.gain.value = muted ? 0 : 0.55;
  }

  global.GameAudio = { init: ensureCtx, playBGM, stopBGM, sfx: SFX, setMuted, get muted(){ return muted; } };
})(window);
