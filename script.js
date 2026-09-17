"use strict";

const DIV_X=10,DIV_Y=8;
const VDIV=[5,2,1,.5,.2,.1,.05,.02,.01,.005,.002,.001];
const TDIV=[.5,.2,.1,.05,.02,.01,.005,.002,.001,.0005,.0002,.0001];
const SCREEN={left:10.91,top:17.7,width:55.45,height:65.7};
const KNOBS={v:{x:85.9,y:33.9},t:{x:85.9,y:74.4}};
const $=id=>document.getElementById(id);
const form=$("generatorForm"),image=$("oscilloscopeImage"),preview=$("preview"),previewData=$("previewData");
const button=$("generateButton"),progressArea=$("progressArea"),progress=$("progress"),progressLabel=$("progressLabel"),progressValue=$("progressValue"),status=$("status");

function hashSeed(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function randomFrom(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function rules(level){
  if(level==="easy")return{a:[1,2,3],p:[2,4,5,8,10],o:[0],ph:[0],vi:[1,2,3,4,5],ti:[4,5,6,7,8,9]};
  if(level==="medium")return{a:[1,1.5,2,2.5,3],p:[2,2.5,3,4,5,6],o:[-1,0,1],ph:[0],vi:[1,2,3,4,5,6],ti:[4,5,6,7,8,9,10]};
  return{a:[1,1.5,2,2.5,3],p:[1.5,2.5,3.5,4.5,5.5,6.5],o:[-2,-1.5,-1,-.5,.5,1,1.5,2],ph:[.125,.25,.375,.625,.75],vi:[1,2,3,4,5,6],ti:[4,5,6,7,8,9,10]};
}

function exercise(level,bankSeed,index,used){
  for(let attempt=0;attempt<1000;attempt++){
    const seed=`${bankSeed}|${level}|${index}|${attempt}`,r=randomFrom(hashSeed(seed)),q=rules(level);
    const vi=pick(r,q.vi),ti=pick(r,q.ti),ad=pick(r,q.a),pd=pick(r,q.p),ph=pick(r,q.ph);
    let od=pick(r,q.o),limit=3.75-ad;od=Math.round(clamp(od,-limit,limit)*2)/2;
    if(level==="hard"&&od===0)continue;
    const key=[vi,ti,ad,od,pd,ph].join("|");if(used.has(key))continue;used.add(key);
    const vd=VDIV[vi],td=TDIV[ti],um=ad*vd,T=pd*td;
    return{level,seed,vi,ti,vd,td,ad,od,pd,ph,um,upp:2*um,umoy:od*vd,T,f:1/T};
  }
  throw new Error(`Pas assez de combinaisons uniques pour ${level}.`);
}

const pct=(v,total)=>v*total/100;
function needle(ctx,w,h,k,index,count){
  const cx=pct(k.x,w),cy=pct(k.y,h),diam=w*.115,len=diam*.40,a=330*index/(count-1)*Math.PI/180,x=cx+Math.sin(a)*len,y=cy-Math.cos(a)*len,s=w/1300;
  ctx.save();ctx.lineCap="round";ctx.lineWidth=6*s;ctx.strokeStyle="rgba(255,255,255,.88)";ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
  ctx.lineWidth=4*s;ctx.strokeStyle="#111";ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
  ctx.fillStyle="#e9e7df";ctx.strokeStyle="rgba(0,0,0,.28)";ctx.lineWidth=s;ctx.beginPath();ctx.arc(cx,cy,diam*.09,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
}

function render(e,canvas){
  const w=image.naturalWidth,h=image.naturalHeight;canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,w,h);
  const sx=pct(SCREEN.left,w),sy=pct(SCREEN.top,h),sw=pct(SCREEN.width,w),sh=pct(SCREEN.height,h),px=sw/DIV_X,py=sh/DIV_Y,cy=sy+sh/2;
  ctx.save();ctx.beginPath();ctx.rect(sx,sy,sw,sh);ctx.clip();ctx.strokeStyle="#08742a";ctx.lineWidth=Math.max(3,w/325);ctx.lineJoin="round";ctx.beginPath();
  const n=Math.ceil(sw*1.25);for(let i=0;i<=n;i++){const xd=DIV_X*i/n,angle=2*Math.PI*(xd/e.pd+e.ph),yd=e.od+e.ad*Math.sin(angle),x=sx+xd*px,y=cy-yd*py;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.restore();
  needle(ctx,w,h,KNOBS.v,e.vi,VDIV.length);needle(ctx,w,h,KNOBS.t,e.ti,TDIV.length);
}

const toBlob=canvas=>new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error("Création du PNG impossible.")),"image/png"));
function num(v){return Object.is(v,-0)?"0":Number(v.toPrecision(12)).toString()}
function csv(rows){
  const head=["id","niveau","graine","V_div_V","s_div_s","Um_V","Upp_V","Umoy_V","T_s","f_Hz","Um_div","Umoy_div","T_div","phase_cycle","fichier"];
  const esc=v=>{const s=String(v).replaceAll('"','""');return/[;"\r\n]/.test(s)?`"${s}"`:s};
  return"\uFEFF"+[head,...rows.map(r=>[r.id,r.level,r.seed,r.vd,r.td,r.um,r.upp,r.umoy,r.T,r.f,r.ad,r.od,r.pd,r.ph,r.file].map(v=>esc(typeof v==="number"?num(v):v)))].map(r=>r.join(";")).join("\r\n");
}

const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^c>>>1:c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&255]^c>>>8;return(c^0xFFFFFFFF)>>>0}
function bytes(fields){const out=new Uint8Array(fields.reduce((s,x)=>s+x[0],0)),v=new DataView(out.buffer);let o=0;for(const [size,value]of fields){size===2?v.setUint16(o,value,true):v.setUint32(o,value>>>0,true);o+=size}return out}
function concat(parts){const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
async function zip(entries){
  const enc=new TextEncoder(),local=[],central=[];let offset=0;
  for(const entry of entries){const name=enc.encode(entry.name),data=entry.data instanceof Uint8Array?entry.data:new Uint8Array(await entry.data.arrayBuffer()),crc=crc32(data);
    const lh=bytes([[4,0x04034b50],[2,20],[2,0x0800],[2,0],[2,0],[2,0],[4,crc],[4,data.length],[4,data.length],[2,name.length],[2,0]]);local.push(lh,name,data);
    const ch=bytes([[4,0x02014b50],[2,20],[2,20],[2,0x0800],[2,0],[2,0],[2,0],[4,crc],[4,data.length],[4,data.length],[2,name.length],[2,0],[2,0],[2,0],[2,0],[4,0],[4,offset]]);central.push(ch,name);offset+=lh.length+name.length+data.length;
  }
  const cd=concat(central),end=bytes([[4,0x06054b50],[2,0],[2,0],[2,entries.length],[2,entries.length],[4,cd.length],[4,offset],[2,0]]);return new Blob([...local,cd,end],{type:"application/zip"});
}

const fileName=(level,i)=>`OSC-${{easy:"E",medium:"M",hard:"H"}[level]}-${String(i).padStart(3,"0")}.png`;
function update(done,total,label){progress.value=done;progress.max=total;progressLabel.textContent=label;progressValue.textContent=`${done} / ${total}`}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function counts(){const c={easy:Number($("easyCount").value),medium:Number($("mediumCount").value),hard:Number($("hardCount").value)};for(const [k,v]of Object.entries(c))if(!Number.isInteger(v)||v<0)throw new Error(`Le nombre ${k} doit être un entier positif ou nul.`);const total=c.easy+c.medium+c.hard;if(!total)throw new Error("La banque doit contenir au moins une image.");if(total>1000)throw new Error("La banque est limitée à 1000 images.");return{c,total}}

async function generate(){
  const{c,total}=counts(),bankSeed=$("seed").value.trim();if(!bankSeed)throw new Error("La graine ne peut pas être vide.");
  button.disabled=true;progressArea.hidden=false;status.textContent="";status.className="status";update(0,total,"Génération…");
  const entries=[],rows=[],canvas=document.createElement("canvas");let done=0;
  for(const level of["easy","medium","hard"]){const used=new Set();for(let i=1;i<=c[level];i++){const e=exercise(level,bankSeed,i,used),name=fileName(level,i);render(e,canvas);entries.push({name:`${level}/${name}`,data:await toBlob(canvas)});rows.push({...e,id:name.slice(0,-4),file:`${level}/${name}`});done++;update(done,total,`Génération ${level}…`);if(done%5===0)await new Promise(r=>setTimeout(r,0))}}
  entries.push({name:"inventaire.csv",data:new TextEncoder().encode(csv(rows))});update(total,total,"Création du ZIP…");const archive=await zip(entries),safe=bankSeed.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-|-$/g,"").slice(0,40)||"banque";download(archive,`oscillo-banque-${total}-${safe}.zip`);status.textContent=`${total} PNG et l’inventaire CSV ont été générés.`;status.className="status success";progressLabel.textContent="Terminé";
}

function showPreview(){if(!image.complete||!image.naturalWidth)return;const e=exercise("hard",`${$("seed").value}|preview|${Date.now()}`,1,new Set());render(e,preview);const d=[["Niveau","Hard"],["V/div",`${num(e.vd)} V`],["s/div",`${num(e.td)} s`],["Um",`${num(e.um)} V`],["Umoy",`${num(e.umoy)} V`]];previewData.replaceChildren(...d.map(([a,b])=>{const w=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=a;dd.textContent=b;w.append(dt,dd);return w}))}
form.addEventListener("submit",async e=>{e.preventDefault();try{await generate()}catch(err){status.textContent=err instanceof Error?err.message:String(err);status.className="status error"}finally{button.disabled=false}});
$("refreshPreview").addEventListener("click",showPreview);image.complete?showPreview():image.addEventListener("load",showPreview,{once:true});
