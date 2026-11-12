(()=>{
'use strict';
const ID='ZncbtRo7RXs', KEY='takabi_music_enabled';
const style=document.createElement('style');
style.textContent=`
#takabiMusicButton{width:46px;height:46px;border-radius:15px;border:1px solid #a985c34a;background:#ffffff9e;color:#7544a1;display:grid;place-items:center;cursor:pointer;box-shadow:0 7px 24px #6b398018;transition:transform .2s,background .2s}
#takabiMusicButton:hover{transform:translateY(-2px);background:#fff}
#takabiMusicButton svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.dark #takabiMusicButton{background:#372b4b;border-color:#6e5884;color:#e8d4ff}
#takabiMusicButton[data-position="fixed"]{position:fixed;top:22px;right:80px;z-index:6}
#takabiMusicPlayer{position:fixed;right:22px;top:82px;z-index:1000;width:240px;padding:8px;background:#fff;border:1px solid #e9dbf2;border-radius:17px;box-shadow:0 18px 45px #30204035;color:#49385c}
.dark #takabiMusicPlayer{background:#302640;border-color:#59446b;color:#f5edff}
#takabiMusicPlayer iframe{display:block;width:224px;height:200px;border:0;border-radius:10px}
#takabiMusicPlayer p{margin:5px 4px 9px;font-size:12px;color:inherit}
@media(max-width:550px){#takabiMusicPlayer{right:10px;top:78px}}
`;
document.head.appendChild(style);
const button=document.createElement('button');button.type='button';button.id='takabiMusicButton';button.title='Play Takabi music';button.setAttribute('aria-label','Play Takabi music');button.setAttribute('aria-pressed','false');
const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
button.innerHTML=icon;
const panel=document.createElement('div');panel.id='takabiMusicPlayer';panel.hidden=true;
const label=document.createElement('p');label.textContent='Takabi • Background music';panel.appendChild(label);
const toolbar=document.querySelector('.topright');
if(toolbar){toolbar.insertBefore(button,toolbar.firstChild);}else{button.dataset.position='fixed';document.body.appendChild(button);}
document.body.appendChild(panel);
function sync(){const active=!panel.hidden;button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'Stop Takabi music':'Play Takabi music');button.title=active?'Stop music':'Play music';}
function stop(){panel.replaceChildren(label);panel.hidden=true;localStorage.setItem(KEY,'false');sync();}
function start(){const iframe=document.createElement('iframe');iframe.title='Takabi YouTube music player';iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.src=`https://www.youtube.com/embed/${ID}?autoplay=1&loop=1&playlist=${ID}&playsinline=1`;panel.appendChild(iframe);panel.hidden=false;localStorage.setItem(KEY,'true');sync();}
button.addEventListener('click',()=>panel.hidden?start():stop());
// Remember the user's preference, but require a new click to resume playback after navigation.
if(localStorage.getItem(KEY)==='true')button.title='Play music (previously enabled)';
sync();
})();
