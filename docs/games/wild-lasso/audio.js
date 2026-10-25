(() => {
  'use strict';

  // Original locally composed western recordings, plus synthesized game sounds.
  // No AudioContext is created until the host calls unlock() from a gesture.
  let context = null, musicBus = null, sfxBus = null, master = null, noiseBuffer = null;
  let unlocked = false, unlockTask = null, music = true, sfx = true, playing = false;
  let hoofTime = 0, hoofIndex = 0, ropeTime = 0;
  let competition=false, urgency=0, excitement=0, ambientTime=0, speechPlayer=null, speechGeneration=0, speechKind=null, queuedCheer=false;
  let musicPlayer=null, musicMode=null, musicTrackIndex=-1, musicPending=null, musicGeneration=0, musicError=false;
  const voices = new Set(), lastEffects = new Map();
  const MAX_VOICES = 80;
  const PLAYLISTS=Object.freeze({
    practice:Object.freeze([{src:'assets/western-training.wav',title:'日落牧场的小路',bpm:88},{src:'assets/western-homecoming.wav',title:'小镇归途',bpm:96}]),
    challenge:Object.freeze([{src:'assets/western-competition.wav',title:'尘土与马刺',bpm:125},{src:'assets/western-hoedown.wav',title:'谷仓狂欢',bpm:142},{src:'assets/western-showdown.wav',title:'正午扬尘',bpm:104}])
  });
  const playlistState={practice:{index:0,time:0},challenge:{index:0,time:0}};
  const desiredMode=()=>competition?'challenge':'practice';
  const selectedTrack=()=>PLAYLISTS[desiredMode()][playlistState[desiredMode()].index];
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const midi = note => 440 * Math.pow(2, (note - 69) / 12);
  const random = (low, high) => low + Math.random() * (high - low);

  function dispose(voice, stop = false) {
    if (!voices.delete(voice)) return;
    if (stop) for (const source of voice.sources) {
      try { source.stop(context.currentTime); } catch (_) {}
    }
    for (const node of voice.nodes) { try { node.disconnect(); } catch (_) {} }
  }
  function stopChannel(channel) {
    for (const voice of [...voices]) if (!channel || voice.channel === channel) dispose(voice, true);
  }
  function prune() {
    if (!context) return;
    for (const voice of [...voices]) if (voice.end < context.currentTime - .1) dispose(voice);
  }
  function makeVoice(channel, when, duration, volume) {
    if (!unlocked || !context || context.state !== 'running') return null;
    if ((channel === 'music' && (!music || !playing)) || (channel === 'sfx' && !sfx)) return null;
    prune();
    if (voices.size >= MAX_VOICES) return null;
    const output = context.createGain();
    output.gain.setValueAtTime(0.0001, when);
    output.connect(channel === 'music' ? musicBus : sfxBus);
    const voice = {channel, output, nodes:[output], sources:[], pending:0, end:when + duration + .04, volume};
    voices.add(voice);
    return voice;
  }
  function own(voice, node) { voice.nodes.push(node); return node; }
  function source(voice, node, when, duration) {
    own(voice, node); voice.sources.push(node); voice.pending++;
    node.onended = () => { voice.pending--; if (voice.pending <= 0) dispose(voice); };
    node.start(when); node.stop(when + duration);
    return node;
  }
  function envelope(voice, when, duration, volume, attack = .007, hold = .03) {
    const gain = voice.output.gain;
    gain.setValueAtTime(.0001, when);
    gain.linearRampToValueAtTime(volume, when + attack);
    gain.setValueAtTime(volume * .75, when + Math.min(duration * .4, attack + hold));
    gain.exponentialRampToValueAtTime(.0001, when + duration);
  }
  function oscillator(voice, type, frequency, when, duration, destination, level = 1) {
    const osc = context.createOscillator(), gain = own(voice, context.createGain());
    osc.type = type; osc.frequency.setValueAtTime(frequency, when); gain.gain.setValueAtTime(level, when);
    osc.connect(gain); gain.connect(destination || voice.output);
    source(voice, osc, when, duration);
    return osc;
  }
  function noise(voice, when, duration, destination, level = 1) {
    const n = context.createBufferSource(), gain = own(voice, context.createGain());
    n.buffer = noiseBuffer; n.loop = true; gain.gain.setValueAtTime(level, when);
    n.connect(gain); gain.connect(destination || voice.output);
    source(voice, n, when, duration);
    return n;
  }

  function pluck(note, when, duration = .35, volume = .10, channel = 'music') {
    const v = makeVoice(channel, when, duration, volume); if (!v) return;
    const f = midi(note), filter = own(v, context.createBiquadFilter());
    filter.type = 'lowpass'; filter.frequency.setValueAtTime(2900, when);
    filter.frequency.exponentialRampToValueAtTime(750, when + duration);
    filter.Q.setValueAtTime(.8, when); filter.connect(v.output);
    const first = oscillator(v, 'triangle', f * 1.006, when, duration, filter, .8);
    first.frequency.exponentialRampToValueAtTime(f, when + .025);
    oscillator(v, 'sine', f * 2.003, when, duration, filter, .18);
    envelope(v, when, duration, volume, .004, .018);
  }
  function wood(when, tone = 210, volume = .14, channel = 'sfx') {
    const duration = .115, v = makeVoice(channel, when, duration, volume); if (!v) return;
    const filter = own(v, context.createBiquadFilter());
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(tone * 4, when); filter.Q.setValueAtTime(1.5, when);
    filter.connect(v.output); noise(v, when, .05, filter, .3);
    const body = oscillator(v, 'sine', tone, when, duration, v.output, .85);
    body.frequency.exponentialRampToValueAtTime(tone * .54, when + .08);
    oscillator(v, 'triangle', tone * 2.41, when, .065, v.output, .15);
    envelope(v, when, duration, volume, .002, .006);
  }
  function brush(when, volume = .025, channel = 'music', duration = .12) {
    const v = makeVoice(channel, when, duration, volume); if (!v) return;
    const filter = own(v, context.createBiquadFilter());
    filter.type = 'highpass'; filter.frequency.setValueAtTime(2200, when); filter.connect(v.output);
    noise(v, when, duration, filter, 1); envelope(v, when, duration, volume, .006, .005);
  }
  function creak(when, volume = .06, duration = .27) {
    const v = makeVoice('sfx', when, duration, volume); if (!v) return;
    const filter = own(v, context.createBiquadFilter());
    filter.type = 'bandpass'; filter.frequency.setValueAtTime(700, when);
    filter.frequency.exponentialRampToValueAtTime(280, when + duration); filter.Q.setValueAtTime(3.5, when);
    filter.connect(v.output);
    const body = oscillator(v, 'sawtooth', random(68,95), when, duration, filter, .32);
    body.frequency.exponentialRampToValueAtTime(45, when + duration);
    noise(v, when, duration, filter, .65);
    envelope(v, when, duration, volume, .025, .025);
  }
  function moo(when, options) {
    const size = options.size || options.type || 'medium', scale = size === 'large' ? .76 : size === 'small' ? 1.28 : 1;
    const duration = random(1.10,1.46), volume = .25 * clamp(Number(options.volume) || 1,.1,1.3);
    const v = makeVoice('sfx', when, duration, volume); if (!v) return;
    const base = random(76,87) * scale, voice = context.createOscillator();
    voice.type = 'sawtooth'; voice.frequency.setValueAtTime(base * .78, when);
    voice.frequency.linearRampToValueAtTime(base * 1.18, when + duration * .28);
    voice.frequency.exponentialRampToValueAtTime(base * .70, when + duration);
    // Formants produce a rounded, voiced "mm-ooo" rather than a plain tone.
    for (const [frequency, q, gain] of [[260,3,.85],[500,4.5,.48],[940,6,.15]]) {
      const formant = own(v, context.createBiquadFilter()), level = own(v, context.createGain());
      formant.type = 'bandpass'; formant.Q.setValueAtTime(q, when);
      formant.frequency.setValueAtTime(frequency * scale * 1.12, when);
      formant.frequency.exponentialRampToValueAtTime(frequency * scale * .72, when + duration);
      level.gain.setValueAtTime(gain, when); voice.connect(formant); formant.connect(level); level.connect(v.output);
    }
    const low = own(v, context.createBiquadFilter()); low.type = 'lowpass'; low.frequency.setValueAtTime(190 * scale, when);
    voice.connect(low); low.connect(v.output);
    source(v, voice, when, duration);
    const vibrato = context.createOscillator(), depth = own(v, context.createGain());
    vibrato.frequency.setValueAtTime(6.1, when); depth.gain.setValueAtTime(base * .035, when);
    vibrato.connect(depth); depth.connect(voice.frequency); source(v, vibrato, when, duration);
    const breath = own(v, context.createBiquadFilter()); breath.type = 'bandpass';
    breath.frequency.setValueAtTime(350 * scale, when); breath.Q.setValueAtTime(.7, when); breath.connect(v.output);
    noise(v, when, duration, breath, .055);
    envelope(v, when, duration, volume, .12, duration * .25);
  }
  function throwSound(when) {
    const duration = .25, v = makeVoice('sfx',when,duration,.17); if (!v) return;
    const filter = own(v,context.createBiquadFilter()); filter.type='bandpass'; filter.Q.setValueAtTime(.8,when);
    filter.frequency.setValueAtTime(700,when); filter.frequency.linearRampToValueAtTime(3200,when+.09);
    filter.frequency.exponentialRampToValueAtTime(450,when+duration); filter.connect(v.output);
    noise(v,when,duration,filter,1); envelope(v,when,duration,.17,.045,.01);
    wood(when+.17,360,.055);
  }

  function kick(when,volume=.12,channel='music') {
    const duration=.23,v=makeVoice(channel,when,duration,volume);if(!v)return;
    const body=oscillator(v,'sine',122,when,duration,v.output,.85);
    body.frequency.exponentialRampToValueAtTime(43,when+.14);
    envelope(v,when,duration,volume,.003,.012);
  }
  function clap(when,volume=.06) {
    const duration=.10,v=makeVoice('sfx',when,duration,volume);if(!v)return;
    const filter=own(v,context.createBiquadFilter());filter.type='bandpass';filter.frequency.setValueAtTime(1250,when);filter.Q.setValueAtTime(.75,when);filter.connect(v.output);
    noise(v,when,duration,filter,.9);envelope(v,when,duration,volume,.003,.008);
  }
  function crowd(when,level=.6) {
    level=clamp(level,.15,1);const duration=1.45+level*.5,v=makeVoice('sfx',when,duration,.13*level);if(!v)return;
    // Broad crowd wash, rounded shout formants, scattered palms and a short cheer whistle.
    for(const [frequency,q,gain] of [[460,.6,.38],[930,.8,.25],[1750,.55,.13]]) {
      const filter=own(v,context.createBiquadFilter());filter.type='bandpass';filter.frequency.setValueAtTime(frequency,when);filter.Q.setValueAtTime(q,when);filter.connect(v.output);noise(v,when,duration,filter,gain);
    }
    for(let i=0;i<3;i++) {
      const filter=own(v,context.createBiquadFilter());filter.type='bandpass';filter.frequency.setValueAtTime(580+i*210,when);filter.Q.setValueAtTime(2,when);filter.connect(v.output);
      const cheer=oscillator(v,'sawtooth',148+i*32,when,duration,filter,.10);
      cheer.frequency.linearRampToValueAtTime(185+i*37,when+.5);cheer.frequency.linearRampToValueAtTime(140+i*30,when+duration);
    }
    envelope(v,when,duration,.13*level,.14,.35);
    for(let i=0;i<5;i++)clap(when+.08+i*.19+random(0,.045),.035+level*.025);
    if(level>.45) {
      const w=makeVoice('sfx',when+.31,.58,.035*level);
      if(w){const osc=oscillator(w,'sine',1050,when+.31,.58,w.output,.7);osc.frequency.linearRampToValueAtTime(1390,when+.48);osc.frequency.linearRampToValueAtTime(1180,when+.85);envelope(w,when+.31,.58,.035*level,.04,.04);}
    }
  }
  function bell(when,volume=.13,frequency=740) {
    const duration=1,v=makeVoice('sfx',when,duration,volume);if(!v)return;
    for(const [ratio,gain] of [[1,.65],[2.76,.15],[4.07,.045]])oscillator(v,'sine',frequency*ratio,when,duration,v.output,gain);
    envelope(v,when,duration,volume,.003,.025);
  }
  function stopSpeech(clearQueue=true) {
    speechGeneration++;
    speechKind=null;if(clearQueue)queuedCheer=false;
    if(speechPlayer){speechPlayer.pause();try{speechPlayer.currentTime=0;}catch(_){}speechPlayer=null;}
    try{window.speechSynthesis?.cancel();}catch(_){}
    if(musicPlayer)musicPlayer.volume=musicVolume();
  }
  function spokenClip(kind) {
    if(!playing)return;
    if(kind==='timedCatch'&&speechKind==='stoneCall'){queuedCheer=true;return;}
    stopSpeech(kind==='stoneCall');const generation=speechGeneration;speechKind=kind;
    const isStone=kind==='stoneCall',text=isStone?'牛来，半导体跌了':'好样的，牛仔！';
    const finish=()=>{
      if(generation!==speechGeneration)return;
      speechPlayer=null;speechKind=null;
      if(queuedCheer&&unlocked&&sfx&&playing){queuedCheer=false;spokenClip('timedCatch');}
      if(musicPlayer)musicPlayer.volume=musicVolume();
    };
    let fellBack=false;
    const fallback=()=>{
      if(fellBack||generation!==speechGeneration||!unlocked||!sfx||!playing)return;fellBack=true;
      if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){finish();return;}
      const utterance=new window.SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=isStone?1.02:1.15;utterance.pitch=isStone?.85:1.1;utterance.volume=.88;
      const voice=window.speechSynthesis.getVoices().find(v=>/^zh(-|_)CN/i.test(v.lang))||window.speechSynthesis.getVoices().find(v=>/^zh/i.test(v.lang));
      if(voice)utterance.voice=voice;utterance.onend=finish;utterance.onerror=finish;window.speechSynthesis.speak(utterance);
    };
    try {
      if(!window.Audio){fallback();return;}
      const clip=new window.Audio(isStone?'assets/semiconductor-call.wav':'assets/cowboy-cheer.wav');speechPlayer=clip;clip.preload='auto';clip.volume=isStone?.76:.94;clip.onerror=fallback;clip.onended=finish;
      const task=clip.play();if(task?.then)Promise.resolve(task).then(()=>{if(generation!==speechGeneration||!playing||!sfx)clip.pause();}).catch(fallback);
      if(musicPlayer)musicPlayer.volume=musicVolume();
    }catch(_){fallback();}
  }

  function pauseMusic() {
    musicGeneration++;musicPending=null;
    if(musicPlayer)musicPlayer.pause();
  }
  function musicVolume() {
    const speechActive=!!speechKind||window.speechSynthesis?.speaking;
    return speechActive?.12:competition?.50+urgency*.025:.44;
  }
  function retireMusic(preserve=true) {
    if(musicPlayer){
      if(preserve&&musicMode&&musicTrackIndex===playlistState[musicMode].index)playlistState[musicMode].time=Number(musicPlayer.currentTime)||0;
      musicPlayer.onended=null;musicPlayer.onerror=null;musicPlayer.onloadedmetadata=null;
    }
    pauseMusic();musicPlayer=null;musicMode=null;musicTrackIndex=-1;
  }
  function nextTrack() {
    const mode=desiredMode();retireMusic();
    playlistState[mode].index=(playlistState[mode].index+1)%PLAYLISTS[mode].length;
    playlistState[mode].time=0;musicError=false;syncMusic();
    return selectedTrack().title;
  }
  function syncMusic() {
    if(!unlocked||!music||!playing||!context||context.state!=='running'||!window.Audio)return;
    const desired=desiredMode(),selection=playlistState[desired];
    if(!musicPlayer||musicMode!==desired||musicTrackIndex!==selection.index) {
      retireMusic();musicMode=desired;musicTrackIndex=selection.index;musicError=false;
      const player=new window.Audio(PLAYLISTS[desired][selection.index].src);
      player.loop=false;player.preload='auto';player.volume=musicVolume();musicPlayer=player;
      const restore=()=>{if(player===musicPlayer&&selection.time>0)try{player.currentTime=Math.min(selection.time,Number.isFinite(player.duration)?Math.max(0,player.duration-.05):selection.time);}catch(_){}};
      restore();player.onloadedmetadata=restore;
      player.onerror=()=>{if(player===musicPlayer)musicError=true;};
      player.onended=()=>{if(player===musicPlayer&&playing&&music)nextTrack();};
    }
    musicPlayer.volume=musicVolume();
    if(musicPlayer.ended){nextTrack();return;}
    if(musicError||musicPending||!musicPlayer.paused)return;
    const player=musicPlayer,generation=++musicGeneration;
    try {
      const result=player.play();
      if(result?.then) {
        const attempt={player,generation};musicPending=attempt;
        Promise.resolve(result).then(()=>{
          if(player!==musicPlayer||!playing||!music)player.pause();
          if(musicPending===attempt)musicPending=null;
        }).catch(error=>{
          if(musicPending===attempt){musicPending=null;if(error?.name!=='AbortError')musicError=true;}
        });
      }
    }catch(_){musicError=true;}
  }
  function resetRhythm() { hoofTime=0; hoofIndex=0; ropeTime=0; }

  async function unlock() {
    if (unlockTask) return unlockTask;
    unlockTask = (async () => {
      try {
        if (!context) {
          const Audio = window.AudioContext || window.webkitAudioContext;
          if (!Audio) return false;
          context = new Audio({latencyHint:'interactive'});
          master = context.createGain(); master.gain.value = .70; master.connect(context.destination);
          musicBus = context.createGain(); musicBus.gain.value = .28; musicBus.connect(master);
          sfxBus = context.createGain(); sfxBus.gain.value = .56; sfxBus.connect(master);
          noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.5), context.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
        }
        if (context.state !== 'running') await context.resume();
        unlocked = context.state === 'running';
        if (unlocked) {musicError=false;syncMusic();}
        return unlocked;
      } catch (_) { unlocked = false; return false; }
    })();
    try { return await unlockTask; } finally { unlockTask = null; }
  }
  function setMusic(value) {
    value=Boolean(value); if (music===value) return;
    music=value;
    if (!music) { stopChannel('music'); pauseMusic(); }
    else {musicError=false;syncMusic();}
  }
  function setSfx(value) {
    value=Boolean(value); if (sfx===value) return;
    sfx=value;
    if (!sfx) { stopChannel('sfx'); resetRhythm(); stopSpeech(); }
  }
  function setPlaying(value) {
    value=Boolean(value); if (playing===value) return;
    playing=value;resetRhythm();
    if (!playing) {pauseMusic();stopChannel();stopSpeech();ambientTime=0;} else {musicError=false;syncMusic();}
  }
  function play(kind, options={}) {
    if (!unlocked || !sfx || !context || context.state!=='running') return false;
    const now=context.currentTime, minimum=kind==='moo'?.55:kind==='crowd'?1.5:kind==='timedCatch'?2:kind==='stoneCall'?1:kind==='warn'?.16:.035;
    if (now-(lastEffects.get(kind)??-Infinity)<minimum) return false;
    const when=now+.005;
    switch(kind) {
      case 'moo': moo(when,options); break;
      case 'throw': throwSound(when); break;
      case 'catch': [69,72,76].forEach((n,i)=>pluck(n,when+i*.085,.32,.15,'sfx')); break;
      case 'warn': wood(when,125,.24); wood(when+.14,155,.18); break;
      case 'miss': brush(when,.16,'sfx',.3); wood(when+.03,110,.11); break;
      case 'gate': creak(when,.16,.43); wood(when+.28,140,.23); wood(when+.42,205,.16); break;
      case 'win': [69,72,76,79,76,81,81].forEach((n,i)=>pluck(n,when+i*.125,i===6?.75:.38,.17,'sfx')); break;
      case 'crowd': crowd(when,Number(options.intensity)||.7); break;
      case 'bell': bell(when,.14); break;
      case 'countdown': bell(when,.09,Number(options.value)===1?830:620); break;
      case 'perfect': [76,81,84,88].forEach((n,i)=>pluck(n,when+i*.065,.36,.15,'sfx'));bell(when+.2,.08,990);break;
      case 'combo': [72,76,79,84].forEach((n,i)=>pluck(n,when+i*.055,.28,.12,'sfx'));clap(when+.22,.08);break;
      case 'charge': kick(when,.24,'sfx');wood(when+.07,110,.15);creak(when+.03,.06,.25);break;
      case 'stoneCall': spokenClip('stoneCall'); break;
      case 'timedCatch': spokenClip('timedCatch');crowd(when,.6);break;
      case 'yank': creak(when,.13,.22);wood(when+.025,165,.20);break;
      case 'yankMiss': creak(when,.065,.20);wood(when+.02,95,.11);break;
      case 'stoneThrow': throwSound(when);wood(when+.10,155,.10);break;
      case 'impact': kick(when,.25,'sfx');wood(when+.015,95,.18);brush(when+.02,.09,'sfx',.18);break;
      case 'hoof': wood(when,220,.13);break;
      case 'rope': creak(when,.06,.3);break;
      default: return false;
    }
    lastEffects.set(kind,now); return true;
  }
  function update(state, dt) {
    competition=state?.gameMode==='challenge';
    const remaining=Number(state?.remaining);
    urgency=competition?clamp((25-(Number.isFinite(remaining)?remaining:100))/25,0,1):0;
    excitement=clamp(Number(state?.excitement)||0,0,100);if(excitement>1)excitement/=100;
    if (!unlocked || !context || context.state!=='running') return;
    prune();syncMusic();
    if (!playing || !sfx || !state || (state.mode && state.mode!=='playing')) { resetRhythm(); return; }
    dt=clamp(Number(dt)||0,0,.1);
    if(competition){ambientTime+=dt;if(ambientTime>7.5-excitement*2.5){ambientTime=0;crowd(context.currentTime+.01,.22+excitement*.32);}}
    const p=state.player || {};
    if (p.moving) {
      hoofTime+=dt; const interval=p.sprinting?.115:.185;
      if (hoofTime>=interval) {
        hoofTime%=interval; hoofIndex++;
        wood(context.currentTime+.004,hoofIndex%2?random(190,230):random(260,310),p.sprinting?.19:.13);
        if (hoofIndex%2===0) wood(context.currentTime+.045,random(145,180),p.sprinting?.10:.07);
      }
    } else hoofTime=0;
    if (state.reeling && state.tether) {
      ropeTime+=dt;
      if (ropeTime>.72) { ropeTime=0; creak(context.currentTime+.004,.045); }
    } else ropeTime=0;
  }
  const snapshot = () => Object.freeze({unlocked,music,sfx,playing,voiceCount:voices.size,competition,tempo:selectedTrack().bpm,musicTrack:selectedTrack().src,trackTitle:selectedTrack().title,trackIndex:playlistState[desiredMode()].index,trackCount:PLAYLISTS[desiredMode()].length,musicPlaying:!!musicPlayer&&!musicPlayer.paused,musicError,speechKind});
  window.RanchAudio = Object.freeze({unlock,setMusic,setSfx,setPlaying,update,play,nextTrack,snapshot});
})();
