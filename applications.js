'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const guildId='1494040030941810798';
const dataDir=process.env.APPLICATION_DATA_DIR||path.join(__dirname,'data');
const file=path.join(dataDir,'applications.json');
fs.mkdirSync(dataDir,{recursive:true});
let store={open:false,nextId:1,applications:[]};
if(fs.existsSync(file)){try{store=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){throw new Error('Application database cannot be read; refusing to overwrite: '+e.message);}}
function save(){const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(store,null,2),{mode:0o600});fs.renameSync(tmp,file);}
const questions=[{id:'roblox',label:'What is your Roblox username?',min:3,max:40},{id:'experience',label:'What moderation experience do you have?',min:30,max:2000},{id:'motivation',label:'Why would you like to join the Takabi Moderator team?',min:40,max:2000},{id:'scenario',label:'How would you handle a disagreement between two community members?',min:40,max:2000},{id:'availability',label:'How active can you be each week?',min:10,max:500}];
function reply(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function manager(user){
  if(!user?.id||!process.env.DISCORD_BOT_TOKEN)return false;
  try{
    const headers={Authorization:'Bot '+process.env.DISCORD_BOT_TOKEN};
    const opts=()=>({headers,signal:AbortSignal.timeout(6500)});
    // Guild owner is authorized independently of role hierarchy.
    const guildResponse=await fetch(`https://discord.com/api/v10/guilds/${guildId}`,opts());
    if(!guildResponse.ok){console.error('[Takabi] Guild lookup failed:',guildResponse.status);return false;}
    const guild=await guildResponse.json();
    if(String(guild.owner_id)===String(user.id))return true;
    const [r,m]=await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`,opts()),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(user.id)}`,opts())
    ]);
    if(!r.ok||!m.ok){console.error('[Takabi] Role/member lookup failed:',r.status,m.status);return false;}
    const roles=await r.json(),member=await m.json();
    const threshold=roles.find(x=>x.name.trim().toLowerCase()==='community manager');
    if(!threshold){console.error('[Takabi] Community Manager role not found');return false;}
    // Discord role positions, not names, determine the hierarchy.
    return roles.some(x=>member.roles.includes(x.id)&&(x.id===threshold.id||x.position>threshold.position));
  }catch(e){console.error('[Takabi] Permission check:',e.message);return false;}
}
async function alreadyStaff(user){
  if(!user?.id||!process.env.DISCORD_BOT_TOKEN)throw new Error('Discord staff verification is unavailable');
  const opts=()=>({headers:{Authorization:'Bot '+process.env.DISCORD_BOT_TOKEN},signal:AbortSignal.timeout(6500)});
  const [g,r,m]=await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${guildId}`,opts()),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`,opts()),
    fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(user.id)}`,opts())
  ]);
  if(m.status===404)return false;
  if(!g.ok||!r.ok||!m.ok)throw new Error('Could not verify Takabi staff roles');
  const guild=await g.json(),roles=await r.json(),member=await m.json();
  if(String(guild.owner_id)===String(user.id))return true;
  const moderator=roles.find(x=>x.name.trim().toLowerCase()==='moderator');
  if(!moderator)throw new Error('Moderator role was not found on Takabi');
  return roles.some(x=>member.roles.includes(x.id)&&(x.id===moderator.id||x.position>moderator.position));
}
async function canDeleteHistory(user){
  if(!user?.id||!process.env.DISCORD_BOT_TOKEN)return false;
  try{
    const headers={Authorization:'Bot '+process.env.DISCORD_BOT_TOKEN};
    const opts=()=>({headers,signal:AbortSignal.timeout(6500)});
    const g=await fetch(`https://discord.com/api/v10/guilds/${guildId}`,opts());
    if(!g.ok)return false;
    const guild=await g.json();
    if(String(guild.owner_id)===String(user.id))return true;
    const [r,m]=await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`,opts()),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(user.id)}`,opts())
    ]);
    if(!r.ok||!m.ok)return false;
    const roles=await r.json(),member=await m.json();
    // Exact role names only. Being above Community Manager is not sufficient.
    return roles.some(x=>member.roles.includes(x.id)&&['owner','co owner','co-owner'].includes(x.name.trim().toLowerCase()));
  }catch(e){console.error('[Takabi] History permissions:',e.message);return false;}
}
async function verifiedRoblox(discordId){
  if(!process.env.BLOXLINK_API_KEY)throw new Error('Roblox verification is not configured');
  const r=await fetch(`https://api.blox.link/v4/public/guilds/${guildId}/discord-to-roblox/${encodeURIComponent(discordId)}`,{headers:{Authorization:process.env.BLOXLINK_API_KEY},signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw new Error('Unable to verify Roblox through Bloxlink');
  const data=await r.json();
  const id=String(data.robloxID||data.robloxId||'');
  if(!/^\d+$/.test(id))throw new Error('Link your Roblox account with Takabi Bloxlink before applying');
  const user=await fetch(`https://users.roblox.com/v1/users/${id}`,{signal:AbortSignal.timeout(6500)});
  if(!user.ok)throw new Error('Unable to retrieve verified Roblox username');
  const profile=await user.json();
  if(typeof profile.name!=='string'||!profile.name)throw new Error('Invalid Roblox profile');
  return {id,username:profile.name};
}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('Payload too large');}return JSON.parse(raw||'{}');}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return false;try{return new URL(origin).origin===new URL(process.env.PUBLIC_URL||`http://localhost:${process.env.PORT||3000}`).origin;}catch{return false;}}
async function handle(req,res,url,user){if(!url.pathname.startsWith('/api/applications/'))return false;
if(!user?.id){reply(res,401,{error:'Sign in with Discord first'});return true;}
const route=url.pathname.slice('/api/applications'.length);
if(req.method==='GET'&&route==='/config'){let staff;try{staff=await alreadyStaff(user);}catch(e){console.error('[Takabi] Staff verification:',e.message);reply(res,503,{error:'Unable to verify your staff role right now. Please try again.'});return true;}reply(res,200,{open:store.open,alreadyStaff:staff,manager:await manager(user),canDeleteHistory:await canDeleteHistory(user),questions});return true;}
if(req.method==='GET'&&route==='/mine'){const a=store.applications.find(x=>x.discord_id===user.id);reply(res,200,{application:a?{id:a.id,status:a.status,created_at:a.created_at}:null});return true;}
if(req.method==='POST'||req.method==='PATCH'||req.method==='DELETE'){if(!sameOrigin(req)){reply(res,403,{error:'Invalid request origin'});return true;}}
if(req.method==='POST'&&route==='/submit'){let staff;try{staff=await alreadyStaff(user);}catch(e){console.error('[Takabi] Staff verification:',e.message);reply(res,503,{error:'Unable to verify your staff role right now. Please try again.'});return true;}if(staff){reply(res,403,{error:'You are already a Takabi staff member (Moderator or higher) and cannot apply.'});return true;}if(!store.open){reply(res,403,{error:'Applications are currently closed'});return true;}if(store.applications.some(x=>x.discord_id===user.id)){reply(res,409,{error:'You have already submitted an application'});return true;}let payload;try{payload=await body(req);}catch{reply(res,400,{error:'Invalid JSON'});return true;}const answers=payload.answers;if(!answers||typeof answers!=='object'||Array.isArray(answers)){reply(res,400,{error:'Invalid answers'});return true;}for(const q of questions){if(typeof answers[q.id]!=='string'||answers[q.id].trim().length<q.min||answers[q.id].length>q.max){reply(res,400,{error:'Please complete: '+q.label});return true;}}let roblox;try{roblox=await verifiedRoblox(user.id);}catch(e){reply(res,422,{error:e.message});return true;}
answers.roblox=roblox.username;
const a={roblox_id:roblox.id,id:store.nextId++,discord_id:user.id,discord_name:String(user.username||'Discord user').slice(0,100),answers:Object.fromEntries(questions.map(q=>[q.id,answers[q.id].trim()])),status:'Needs Review',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),reviewed_by:null};store.applications.push(a);save();reply(res,201,{id:a.id});return true;}
if(req.method==='DELETE'&&route==='/manage/history'){
  if(!await canDeleteHistory(user)){reply(res,403,{error:'Only the server Owner or Co Owner can clear application history'});return true;}
  let p;try{p=await body(req);}catch{reply(res,400,{error:'Invalid JSON'});return true;}
  if(p.confirm!=='DELETE ALL APPLICATIONS'){reply(res,400,{error:'Confirmation phrase does not match'});return true;}
  const removed=store.applications.length;
  if(removed){
    const backups=path.join(dataDir,'history-backups');fs.mkdirSync(backups,{recursive:true});
    const backup=path.join(backups,'applications-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex')+'.json');
    fs.writeFileSync(backup,JSON.stringify(store,null,2),{flag:'wx',mode:0o600});
    store.applications=[];save();
  }
  reply(res,200,{ok:true,removed});return true;
}
if(route.startsWith('/manage')){if(!await manager(user)){reply(res,403,{error:'Community Manager or higher required'});return true;}
if(req.method==='GET'&&route==='/manage'){reply(res,200,{open:store.open,applications:[...store.applications].reverse().map(({answers,...rest})=>rest)});return true;}
if(req.method==='PATCH'&&route==='/manage/settings'){let p;try{p=await body(req);}catch{reply(res,400,{error:'Invalid JSON'});return true;}if(typeof p.open!=='boolean'){reply(res,400,{error:'Invalid setting'});return true;}store.open=p.open;save();reply(res,200,{open:store.open});return true;}
const match=route.match(/^\/manage\/(\d+)$/);if(match){const a=store.applications.find(x=>x.id===Number(match[1]));if(!a){reply(res,404,{error:'Not found'});return true;}if(req.method==='GET'){reply(res,200,a);return true;}if(req.method==='PATCH'){let p;try{p=await body(req);}catch{reply(res,400,{error:'Invalid JSON'});return true;}if(!['Needs Review','Approved','Denied'].includes(p.status)){reply(res,400,{error:'Invalid status'});return true;}a.status=p.status;a.updated_at=new Date().toISOString();a.reviewed_by=user.id;save();reply(res,200,{ok:true});return true;}}}
reply(res,404,{error:'Not found'});return true;}
module.exports={handle,manager,alreadyStaff};
