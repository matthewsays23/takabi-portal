// Takabi Staff Portal — native Node.js 20+ server with Discord OAuth and applications.
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {URL,URLSearchParams}=require('node:url');
const applications=require('./applications');
const PORT=Number(process.env.PORT||3000);
const BASE=process.env.PUBLIC_URL||`http://localhost:${PORT}`;
const CLIENT_ID=process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET=process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET=process.env.SESSION_SECRET;
const BLOXLINK_API_KEY=process.env.BLOXLINK_API_KEY;
const TAKABI_GUILD_ID='1494040030941810798';
const secure=BASE.startsWith('https://');
const callback=new URL('/auth/callback',BASE).toString();
const sessions=new Map(),states=new Map();
const now=()=>Date.now();
const random=()=>crypto.randomBytes(32).toString('hex');
const sign=v=>crypto.createHmac('sha256',SESSION_SECRET||'not-configured').update(v).digest('hex');
function cookie(req,name){const m=(req.headers.cookie||'').match(new RegExp('(?:^|; )'+name+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
function setCookie(res,name,value,age){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure?'; Secure':''}`);}
function redirect(res,location){res.writeHead(302,{'Location':location,'Cache-Control':'no-store'});res.end();}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
function session(req){const raw=cookie(req,'takabi_session');if(!raw)return null;const [id,mac]=raw.split('.');if(!id||!mac||!/^[0-9a-f]{64}$/.test(mac))return null;const expected=sign(id);if(!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))return null;const s=sessions.get(id);if(!s||s.expires<now()){sessions.delete(id);return null;}return{id,...s};}
function cleanup(){for(const[k,v]of sessions)if(v.expires<now())sessions.delete(k);for(const[k,v]of states)if(v.expires<now())states.delete(k);}
const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.rbxcdn.com https://cdn.discordapp.com; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";
function html(res,filename){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp});fs.createReadStream(path.join(__dirname,filename)).pipe(res);}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,BASE);
  // Application API must run BEFORE the GET-only restriction (submit/settings use POST/PATCH).
  if(url.pathname.startsWith('/api/applications/')){await applications.handle(req,res,url,session(req)?.user||null);return;}
  if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return;}
  if(url.pathname==='/auth/discord'){
   if(!CLIENT_ID||!CLIENT_SECRET||!SESSION_SECRET){redirect(res,'/?error=config');return;}
   cleanup();const state=random();states.set(state,{expires:now()+10*60*1000,next:url.searchParams.get('next')==='apply'?'/apply':'/dashboard'});
   const params=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:callback,response_type:'code',scope:'identify',state,prompt:'consent'});
   redirect(res,'https://discord.com/oauth2/authorize?'+params);return;
  }
  if(url.pathname==='/auth/callback'){
   if(url.searchParams.get('error')){redirect(res,'/?error=denied');return;}
   const state=url.searchParams.get('state'),stored=states.get(state);if(state)states.delete(state);
   if(!stored||stored.expires<now()||!url.searchParams.get('code')){redirect(res,'/?error=state');return;}
   const tokenResponse=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:CLIENT_ID,client_secret:CLIENT_SECRET,grant_type:'authorization_code',code:url.searchParams.get('code'),redirect_uri:callback})});
   if(!tokenResponse.ok){redirect(res,'/?error=oauth');return;}
   const tokens=await tokenResponse.json();
   const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+tokens.access_token}});
   if(!userResponse.ok){redirect(res,'/?error=oauth');return;}
   const user=await userResponse.json(),id=random();
   sessions.set(id,{user:{id:user.id,username:user.global_name||user.username,avatar:user.avatar},expires:now()+12*60*60*1000});
   setCookie(res,'takabi_session',id+'.'+sign(id),12*60*60);
   redirect(res,stored.next||'/dashboard');return;
  }
  if(url.pathname==='/auth/logout'){const s=session(req);if(s)sessions.delete(s.id);setCookie(res,'takabi_session','',0);redirect(res,'/');return;}
  if(url.pathname==='/api/roblox'){
   const s=session(req);if(!s){json(res,401,{error:'Sign in first'});return;}
   if(!BLOXLINK_API_KEY){json(res,200,{linked:false,reason:'not_configured'});return;}
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);let result;
    try{result=await fetch(`https://api.blox.link/v4/public/guilds/${TAKABI_GUILD_ID}/discord-to-roblox/${encodeURIComponent(s.user.id)}`,{headers:{Authorization:BLOXLINK_API_KEY},signal:controller.signal});}finally{clearTimeout(timer);}
    if(result.status===404){json(res,200,{linked:false,reason:'not_linked'});return;}
    if(!result.ok){json(res,502,{error:'Roblox verification is temporarily unavailable'});return;}
    const data=await result.json(),robloxId=String(data.robloxID||data.robloxId||'');
    if(!/^\d+$/.test(robloxId)){json(res,200,{linked:false,reason:'not_linked'});return;}
    const[profileResult,avatarResult]=await Promise.allSettled([
     fetch(`https://users.roblox.com/v1/users/${robloxId}`).then(r=>r.ok?r.json():null),
     fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`).then(r=>r.ok?r.json():null)
    ]);
    const profile=profileResult.status==='fulfilled'?profileResult.value:null;
    const avatarData=avatarResult.status==='fulfilled'?avatarResult.value:null;
    const image=avatarData?.data?.[0]?.imageUrl;
    json(res,200,{linked:true,id:robloxId,username:profile?.name||`Roblox user ${robloxId}`,displayName:profile?.displayName||profile?.name||`Roblox user ${robloxId}`,avatar:typeof image==='string'&&image.startsWith('https://')?image:null});return;
   }catch(error){console.error('[Takabi] Roblox lookup:',error.message);json(res,502,{error:'Could not check Roblox account right now'});return;}
  }
  if(url.pathname==='/api/me'){const s=session(req);json(res,200,s?{authenticated:true,user:s.user}:{authenticated:false});return;}
  if(url.pathname==='/apply'||url.pathname==='/apply.html'){
   html(res,'apply.html');return;
  }
  if(url.pathname==='/dashboard'||url.pathname==='/dashboard.html'){
   if(!session(req)){redirect(res,'/');return;}
   html(res,'dashboard.html');return;
  }
  if(url.pathname==='/'||url.pathname==='/index.html'){html(res,'index.html');return;}
  const assets={'/assets/takabi-logo.png':'image/png','/assets/icon.png':'image/png'};
  if(assets[url.pathname]){res.writeHead(200,{'Content-Type':assets[url.pathname],'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});fs.createReadStream(path.join(__dirname,url.pathname)).pipe(res);return;}
  json(res,404,{error:'Not found'});
 }catch(err){console.error('[Takabi]',err);if(!res.headersSent)json(res,500,{error:'Internal server error'});else res.end();}
});
server.listen(PORT,()=>console.log(`Takabi portal listening on port ${PORT}; Discord redirect URI: ${callback}`));
