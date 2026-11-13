'use strict';
const fs=require('node:fs'),path=require('node:path');
const folder=process.env.APPLICATION_DATA_DIR||path.join(__dirname,'data');fs.mkdirSync(folder,{recursive:true});
const filename=path.join(folder,'server-logs.jsonl');
const LIMIT=100000;let count=0;
function append(category,title,detail='',actor='',target='',meta={}){
 const entry={at:new Date().toISOString(),category,title:String(title).slice(0,200),detail:String(detail).slice(0,4000),actor:String(actor||'').slice(0,160),target:String(target||'').slice(0,160),meta};
 fs.appendFileSync(filename,JSON.stringify(entry)+'\n',{mode:0o600});count++;
 if(count>=LIMIT){const lines=fs.readFileSync(filename,'utf8').trim().split('\n');fs.writeFileSync(filename,lines.slice(-50000).join('\n')+'\n',{mode:0o600});count=0;}
}
function query(params){const raw=fs.existsSync(filename)?fs.readFileSync(filename,'utf8').split('\n').filter(Boolean):[];const entries=raw.flatMap((line,i)=>{try{return [{...JSON.parse(line),seq:i+1}]}catch{return []}}).reverse();const category=params.get('category')||'',q=(params.get('q')||'').toLowerCase().slice(0,100),before=Number(params.get('before')||Infinity),limit=Math.min(100,Math.max(1,Number(params.get('limit')||40)));const filtered=entries.filter(x=>x.seq<before&&(!category||x.category===category)&&(!q||[x.title,x.detail,x.actor,x.target].some(y=>String(y||'').toLowerCase().includes(q))));const page=filtered.slice(0,limit);return {events:page,next:filtered.length>limit?String(page.at(-1).seq):null,total:entries.length,last24h:entries.filter(x=>Date.parse(x.at)>Date.now()-86400000).length,latest:entries[0]?.at||null};}
module.exports={append,query};
