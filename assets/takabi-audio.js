(()=>{
'use strict';
if(document.getElementById('takabi-audio-toggle'))return;
const audio=new Audio();
audio.volume=0.10;
audio.preload='auto';
const tracks=['/assets/music1.mp3','/assets/music2.mp3'];
let index=0;
// Start every new page with music enabled; a visitor can mute for this page.
let enabled=true;
const button=document.createElement('button');
button.id='takabi-audio-toggle';
button.className='takabi-audio-button';
button.type='button';
const onIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
const offIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M3 3l18 18"/></svg>';
function update(){
 button.classList.toggle('off',!enabled);
 button.innerHTML=enabled?onIcon:offIcon;
 button.setAttribute('aria-label',enabled?'Mute background music':'Play background music');
 button.title=enabled?'Mute music':'Play music';
}
function play(){
 if(!enabled)return;
 const attempt=audio.play();
 if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>{});
}
button.addEventListener('click',()=>{
 enabled=!enabled;
 update();
 if(enabled)play();else audio.pause();
});
audio.addEventListener('ended',()=>{
 index=(index+1)%tracks.length;
 audio.src=tracks[index];
 play();
});
audio.addEventListener('error',()=>{
 if(index===0){index=1;audio.src=tracks[index];play();}
});
const theme=document.getElementById('theme');
if(theme&&theme.parentElement&&theme.parentElement.classList.contains('topright')){
 theme.parentElement.insertBefore(button,theme);
}else document.body.appendChild(button);
update();
audio.src=tracks[index];
audio.load();
// Browser autoplay restrictions may require a genuine visitor interaction.
document.addEventListener('pointerdown',()=>{if(enabled&&audio.paused)play();},true);
document.addEventListener('keydown',()=>{if(enabled&&audio.paused)play();},true);
play();
})();
