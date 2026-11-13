(()=>{
'use strict';
if(document.getElementById('takabi-audio-toggle'))return;
const tracks=['/assets/music1.mp3','/assets/music2.mp3'];
const storageKey='takabi-playlist-progress-v2';
const audio=new Audio();
audio.preload='auto';audio.volume=0.10;audio.loop=false;
let enabled=true,index=0,lastSaved=0,failed=new Set();
try{const previous=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(previous&&Number.isInteger(previous.index)&&previous.index>=0&&previous.index<tracks.length){index=previous.index;lastSaved=Number(previous.time)||0;}}catch{}
const button=document.createElement('button');button.id='takabi-audio-toggle';button.className='takabi-audio-button';button.type='button';
const onIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
const offIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M3 3l18 18"/></svg>';
function update(){button.classList.toggle('off',!enabled);button.innerHTML=enabled?onIcon:offIcon;button.setAttribute('aria-label',enabled?'Mute background music':'Play background music');button.title=enabled?'Mute music':'Play music';}
function save(){try{sessionStorage.setItem(storageKey,JSON.stringify({index,time:Number.isFinite(audio.currentTime)?audio.currentTime:0}));}catch{}}
function play(){if(!enabled)return;const promise=audio.play();if(promise&&promise.catch)promise.catch(()=>{});}
function loadTrack(next,position=0){index=next;lastSaved=position;audio.src=tracks[index];audio.load();save();play();}
function nextTrack(){failed.clear();loadTrack((index+1)%tracks.length);}
button.addEventListener('click',()=>{enabled=!enabled;update();if(enabled)play();else audio.pause();});
audio.addEventListener('loadedmetadata',()=>{if(lastSaved>0&&Number.isFinite(audio.duration)&&audio.duration>0){audio.currentTime=Math.min(lastSaved,Math.max(0,audio.duration-0.25));lastSaved=0;}});
audio.addEventListener('timeupdate',()=>{if(Math.abs(audio.currentTime-lastSaved)>2){lastSaved=audio.currentTime;save();}});
audio.addEventListener('ended',nextTrack);
audio.addEventListener('error',()=>{failed.add(index);if(failed.size<tracks.length){loadTrack((index+1)%tracks.length);}else{console.warn('Takabi music: neither track could load. Verify /assets/music1.mp3 and /assets/music2.mp3.');}});
const theme=document.getElementById('theme');if(theme&&theme.parentElement&&theme.parentElement.classList.contains('topright'))theme.parentElement.insertBefore(button,theme);else document.body.appendChild(button);
update();loadTrack(index,lastSaved);
// Browsers can block audible autoplay until a genuine user gesture.
document.addEventListener('pointerdown',()=>{if(enabled&&audio.paused)play();},true);
document.addEventListener('keydown',()=>{if(enabled&&audio.paused)play();},true);
window.addEventListener('pagehide',save);
})();
