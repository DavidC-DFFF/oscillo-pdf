"use strict";

const DIV_X=10,DIV_Y=8;
const WAVES=["sinus","triangle","carre"],LEVELS=["easy","medium","hard"];
const EXPORT_WIDTH=900,WEBP_QUALITY=.9;
const SQUARE_START_DIV=1,SQUARE_MARGIN_DIV=.5;
const VDIV=[5,2,1,.5,.2,.1,.05,.02,.01,.005,.002,.001];
const TDIV=[.5,.2,.1,.05,.02,.01,.005,.002,.001,.0005,.0002,.0001];
// Centres des lignes extrêmes du quadrillage dans l’image 1302 × 896.
const SCREEN={left:156/1302*100,top:159/896*100,width:(850.5-156)/1302*100,height:(738.5-159)/896*100};
const KNOBS={v:{x:85.9,y:33.9},t:{x:85.9,y:74.4}};
const $=id=>document.getElementById(id);
const form=$("generatorForm"),image=$("oscilloscopeImage"),preview=$("preview"),previewData=$("previewData");
const button=$("generateButton"),progressArea=$("progressArea"),progress=$("progress"),progressLabel=$("progressLabel"),progressValue=$("progressValue"),status=$("status");

function hashSeed(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function randomFrom(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const fifths=(from,to)=>Array.from({length:to-from+1},(_,i)=>(from+i)/5);
const divisionStep=level=>level==="easy"?1:level==="medium"?.5:.2;

function rules(level){
  if(level==="easy")return{a:[1,2,3],p:[5,6,7,8,9,10],o:[0],ph:[0],vi:[1,2,3,4,5,6,7],ti:[4,5,6,7,8,9,10,11]};
  if(level==="medium")return{a:[1,1.5,2,2.5,3],p:[5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10],o:[-1,0,1],ph:[0],vi:[1,2,3,4,5,6],ti:[4,5,6,7,8,9,10]};
  return{a:fifths(5,15),p:fifths(25,50),o:fifths(-10,10).filter(value=>value!==0),ph:[0],vi:[1,2,3,4,5,6],ti:[4,5,6,7,8,9,10]};
}

function maximizeVertical(level,vi,ad,od,maxExtent=DIV_Y/2){
  const um=ad*VDIV[vi],umoy=od*VDIV[vi],step=divisionStep(level);
  let best={vi,vd:VDIV[vi],ad,od,um,umoy};
  for(let candidate=vi+1;candidate<VDIV.length;candidate++){
    const vd=VDIV[candidate],nextAd=um/vd,nextOd=umoy/vd;
    if(Math.abs(nextOd)+nextAd>maxExtent+1e-9)continue;
    if([nextAd,nextOd].some(value=>Math.abs(value/step-Math.round(value/step))>1e-9))continue;
    best={vi:candidate,vd,ad:Math.round(nextAd/step)*step,od:Math.round(nextOd/step)*step,um,umoy};
  }
  return best;
}

function squareRules(level){
  if(level==="easy")return{a:[1,2,3],d:[50],p:[6,8],vi:[0,1,2,3,4,5,6,7,8],ti:[0,1,2,3,4,5,6,7,8,9,10,11]};
  if(level==="medium")return{a:[1,1.5,2,2.5,3,3.5],d:[25,50,75],p:[6,8],vi:[0,1,2,3,4,5,6,7,8,9],ti:[0,1,2,3,4,5,6,7,8,9,10,11]};
  return{a:fifths(5,17),d:[20,40,60,80],p:[5,6,7,8],vi:[0,1,2,3,4,5,6,7,8,9,10],ti:[0,1,2,3,4,5,6,7,8,9,10,11]};
}

function exercise(level,bankSeed,index,used,wave="sinus"){
  if(!WAVES.includes(wave))throw new Error(`Signal inconnu : ${wave}.`);
  for(let attempt=0;attempt<1000;attempt++){
    const seed=wave==="sinus"?`${bankSeed}|${level}|${index}|${attempt}`:`${bankSeed}|${wave}|${level}|${index}|${attempt}`;
    const r=randomFrom(hashSeed(seed));
    if(wave==="carre"){
      const q=squareRules(level),ad=pick(r,q.a),D=pick(r,q.d),vi=pick(r,q.vi),ti=pick(r,q.ti),pd=pick(r,q.p);
      const vertical=maximizeVertical(level,vi,ad,0,DIV_Y/2-SQUARE_MARGIN_DIV),key=[vertical.vi,ti,vertical.ad,pd,D].join("|");
      if(used.has(key))continue;used.add(key);
      const td=TDIV[ti],hd=pd*D/100,T=pd*td;
      return{wave,level,seed,vi:vertical.vi,vd:vertical.vd,ad:vertical.ad,highDiv:vertical.ad,lowDiv:-vertical.ad,ti,td,pd,hd,th:hd*td,D,umax:vertical.um,upp:2*vertical.um,T,f:1/T};
    }
    const q=rules(level);
    const vi=pick(r,q.vi),ti=pick(r,q.ti),ad=pick(r,q.a),pd=pick(r,q.p),ph=pick(r,q.ph);
    let od=pick(r,q.o),limit=3.75-ad,step=divisionStep(level);
    od=Math.round(clamp(od,-limit,limit)/step)*step;
    if(level==="hard"&&od===0)continue;
    const vertical=maximizeVertical(level,vi,ad,od);
    // Un sommet nul ou négatif n'est pas exploitable pour la lecture de Umax.
    const peakSteps=Math.round(vertical.ad/step)+Math.round(vertical.od/step);
    if(peakSteps<=0)continue;
    const key=[vertical.vi,ti,vertical.ad,vertical.od,pd,ph].join("|");
    if(used.has(key))continue;used.add(key);
    const td=TDIV[ti],T=pd*td;
    return{wave,level,seed,...vertical,ti,td,pd,ph,umax:(vertical.ad+vertical.od)*vertical.vd,upp:2*vertical.um,T,f:1/T};
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
  ctx.save();ctx.beginPath();ctx.rect(sx,sy,sw,sh);ctx.clip();
  if(e.wave!=="carre"&&e.od!==0){const y=cy-e.od*py;ctx.strokeStyle="#d62828";ctx.lineWidth=Math.max(2,w/520);ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+sw,y);ctx.stroke()}
  ctx.strokeStyle="#08742a";ctx.lineWidth=e.wave==="carre"?Math.max(5,w/200):Math.max(3,w/325);ctx.lineJoin="round";ctx.beginPath();
  if(e.wave==="carre"){
    const yHigh=cy-e.highDiv*py,yLow=cy-e.lowDiv*py;
    ctx.moveTo(sx,yLow);
    let reachesRightOnHigh=false;
    for(let start=SQUARE_START_DIV;start<DIV_X;start+=e.pd){
      const xRise=sx+start*px,fall=start+e.hd;
      ctx.lineTo(xRise,yLow);ctx.lineTo(xRise,yHigh);
      if(fall>=DIV_X){ctx.lineTo(sx+sw,yHigh);reachesRightOnHigh=true;break}
      const xFall=sx+fall*px;
      ctx.lineTo(xFall,yHigh);ctx.lineTo(xFall,yLow);
    }
    if(!reachesRightOnHigh)ctx.lineTo(sx+sw,yLow);
  }else if(e.wave==="triangle"){
    ctx.moveTo(sx,cy-e.od*py);
    for(let start=0;start<DIV_X;start+=e.pd){
      ctx.lineTo(sx+(start+e.pd/4)*px,cy-(e.od+e.ad)*py);
      ctx.lineTo(sx+(start+3*e.pd/4)*px,cy-(e.od-e.ad)*py);
      ctx.lineTo(sx+(start+e.pd)*px,cy-e.od*py);
    }
  }else{
    const n=Math.ceil(sw*1.25);for(let i=0;i<=n;i++){const xd=DIV_X*i/n,angle=2*Math.PI*(xd/e.pd+e.ph),yd=e.od+e.ad*Math.sin(angle),x=sx+xd*px,y=cy-yd*py;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  }
  ctx.stroke();ctx.restore();
  needle(ctx,w,h,KNOBS.v,e.vi,VDIV.length);needle(ctx,w,h,KNOBS.t,e.ti,TDIV.length);
}

function resizeForExport(source,target){
  target.width=EXPORT_WIDTH;target.height=Math.round(source.height*EXPORT_WIDTH/source.width);
  const ctx=target.getContext("2d");ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(source,0,0,target.width,target.height);
}
const toBlob=(canvas,type="image/png",quality)=>new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(new Error(`Création du ${type} impossible.`)),type,quality));
function num(v){return Object.is(v,-0)?"0":Number(v.toPrecision(15)).toString()}
function validateExercise(e){
  const close=(actual,expected)=>Number.isFinite(actual)&&Math.abs(actual-expected)<=1e-12*Math.max(1e-12,Math.abs(expected));
  const step=divisionStep(e.level),onGrid=value=>close(value/step,Math.round(value/step));
  const common=e.vd===VDIV[e.vi]&&e.td===TDIV[e.ti]&&e.T>0&&e.pd>=5&&e.pd<=10&&
    close(e.T,e.pd*e.td)&&close(e.f,1/e.T)&&onGrid(e.pd)&&onGrid(e.ad);
  const square=e.wave==="carre"&&e.ad>0&&e.highDiv===-e.lowDiv&&e.highDiv===e.ad&&e.ad<=DIV_Y/2-SQUARE_MARGIN_DIV+1e-9&&
    SQUARE_START_DIV+e.pd<=DIV_X-1+1e-9&&
    e.D>0&&e.D<100&&onGrid(e.hd)&&close(e.umax,e.highDiv*e.vd)&&close(e.hd,e.pd*e.D/100)&&close(e.th,e.hd*e.td);
  const other=e.wave!=="carre"&&e.umax>0&&Math.abs(e.od)+e.ad<=DIV_Y/2+1e-9&&
    onGrid(e.od)&&close(e.umoy,e.od*e.vd)&&close(e.umax,(e.od+e.ad)*e.vd);
  if(!common||!(square||other)){
    throw new Error(`Valeurs incohérentes pour ${e.id||e.seed}.`);
  }
}
function answerKey(rows){
  const head="id;signal;Umoy_V;Umax_V;f_Hz;T_s;D_pct";
  return"\uFEFF"+[head,...rows.map(r=>[r.id,r.wave,r.wave==="carre"?"":r.umoy,r.umax,r.f,r.T,r.wave==="carre"?r.D:""].map(v=>typeof v==="number"?num(v):v).join(";"))].join("\r\n");
}
function csv(rows){
  const head=["id","signal","niveau","graine","V_div_V","s_div_s","Um_V","Umax_V","Upp_V","Umoy_V","T_s","f_Hz","Um_div","Umoy_div","T_div","phase_cycle","Uhaut_div","Ubas_div","Th_div","Th_s","D_pct","fichier"];
  const esc=v=>{const s=String(v).replaceAll('"','""');return/[;"\r\n]/.test(s)?`"${s}"`:s};
  return"\uFEFF"+[head,...rows.map(r=>[r.id,r.wave,r.level,r.seed,r.vd,r.td,r.um??"",r.umax,r.upp,r.wave==="carre"?"":r.umoy,r.T,r.f,r.ad,r.od??"",r.pd,r.ph??"",r.highDiv??"",r.lowDiv??"",r.hd??"",r.th??"",r.D??"",r.file].map(v=>esc(typeof v==="number"?num(v):v)))].map(r=>r.join(";")).join("\r\n");
}

function xmlText(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function cdata(value){return String(value).replaceAll("]]>","]]]]><![CDATA[>")}
async function blobBase64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary="";const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function answer(value,tolerance){return `{1:NUMERICAL:=${num(value)}:${num(tolerance)}}`}
async function moodleXml(rows,level,wave="sinus"){
  const title={easy:"Easy",medium:"Medium",hard:"Hard"}[level];
  const category=wave==="sinus"?`$course$/top/Oscilloscope/${title}`:`$course$/top/Oscilloscope/${wave==="carre"?"Carré":"Triangle"}/${title}`;
  const parts=['<?xml version="1.0" encoding="UTF-8"?>','<quiz>',`<question type="category"><category><text>${category}</text></category></question>`];
  for(const r of rows){
    const imageName=r.id+".webp",base64=await blobBase64(r.webp);
    const tolUmax=r.umax*.05,tolT=Math.abs(r.T)*.05,tolF=Math.abs(r.f)*.05;
    const values=wave==="carre"?
      [["Umax (V)",r.umax,tolUmax],["T (s)",r.T,tolT],["f (Hz)",r.f,tolF],["D (%)",r.D,r.D*.05]]:
      [["Umax (V)",r.umax,tolUmax],["Umoy (V)",r.umoy,r.umoy===0?r.vd*.1:Math.abs(r.umoy)*.05],["T (s)",r.T,tolT],["f (Hz)",r.f,tolF]];
    const body=`<p><strong>Relevez les quatre caractéristiques du signal.</strong></p><p>Saisissez uniquement les valeurs numériques. Le point et la virgule sont acceptés. N’ajoutez aucune unité.</p><p><img src="@@PLUGINFILE@@/${imageName}" alt="Oscillogramme ${r.id}" style="max-width:100%;height:auto"></p><table>${values.map(([label,value,tolerance])=>`<tr><td>${label}</td><td>${answer(value,tolerance)}</td></tr>`).join("")}</table>`;
    const feedback=values.map(([label,value])=>`${label.slice(0,label.indexOf(" ("))} = ${num(value)} ${label.match(/\(([^)]+)\)/)[1]}`).join(" ; ")+".";
    parts.push(`<question type="cloze"><name><text>${r.id}</text></name><questiontext format="html"><text><![CDATA[${cdata(body)}]]></text><file name="${xmlText(imageName)}" path="/" encoding="base64">${base64}</file></questiontext><generalfeedback format="html"><text><![CDATA[${cdata(feedback)}]]></text></generalfeedback><defaultgrade>4.0000000</defaultgrade><penalty>0.3333333</penalty><hidden>0</hidden><idnumber>${r.id}</idnumber><tags><tag><text>oscilloscope</text></tag><tag><text>${wave}</text></tag><tag><text>${level}</text></tag></tags></question>`);
  }
  parts.push("</quiz>");return parts.join("\n");
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

const fileName=(level,i,wave="sinus")=>`${{sinus:"OSC",triangle:"TRI",carre:"CAR"}[wave]}-${{easy:"E",medium:"M",hard:"H"}[level]}-${String(i).padStart(3,"0")}.png`;
const imageFolder=(wave,level)=>wave==="sinus"?level:`${wave}/${level}`;
function update(done,total,label){progress.value=done;progress.max=total;progressLabel.textContent=label;progressValue.textContent=`${done} / ${total}`}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
function counts(){
  const c={};let total=0;
  for(const wave of WAVES){
    c[wave]={};
    for(const level of LEVELS){
      const id=wave==="sinus"?`${level}Count`:`${wave}${level[0].toUpperCase()+level.slice(1)}Count`;
      const value=Number($(id).value);
      if(!Number.isInteger(value)||value<0||value>500)throw new Error(`Le nombre ${wave} ${level} doit être compris entre 0 et 500.`);
      c[wave][level]=value;total+=value;
    }
  }
  if(!total)throw new Error("La banque doit contenir au moins une image.");
  if(total>1000)throw new Error("La banque est limitée à 1000 images.");
  return{c,total};
}

async function generate(){
  const{c,total}=counts(),bankSeed=$("seed").value.trim();if(!bankSeed)throw new Error("La graine ne peut pas être vide.");
  const includePng=$("includePng").checked;
  button.disabled=true;progressArea.hidden=false;status.textContent="";status.className="status";update(0,total,"Génération…");
  const entries=[],rows=[],canvas=document.createElement("canvas"),exportCanvas=document.createElement("canvas");let done=0;
  for(const wave of WAVES)for(const level of LEVELS){const used=new Set();for(let i=1;i<=c[wave][level];i++){
    const e=exercise(level,bankSeed,i,used,wave),name=fileName(level,i,wave),id=name.slice(0,-4),folder=imageFolder(wave,level),file=`${folder}/${id}.webp`;
    validateExercise(e);render(e,canvas);resizeForExport(canvas,exportCanvas);
    const webp=await toBlob(exportCanvas,"image/webp",WEBP_QUALITY);
    if(webp.type!=="image/webp")throw new Error("Ce navigateur ne permet pas la création d’images WebP.");
    entries.push({name:file,data:webp});
    if(includePng)entries.push({name:`${folder}/${name}`,data:await toBlob(exportCanvas)});
    rows.push({...e,id,file,webp});done++;update(done,total,`Génération ${wave} ${level}…`);
    if(done%5===0)await new Promise(r=>setTimeout(r,0));
  }}
  entries.push({name:"inventaire.csv",data:new TextEncoder().encode(csv(rows))});
  entries.push({name:"corrige.csv",data:new TextEncoder().encode(answerKey(rows))});
  update(total,total,"Création des banques Moodle…");
  for(const wave of WAVES)for(const level of LEVELS){const selected=rows.filter(r=>r.wave===wave&&r.level===level);if(selected.length){const name=wave==="sinus"?`oscillo-${level}.xml`:`oscillo-${wave}-${level}.xml`;entries.push({name:`moodle/${name}`,data:new TextEncoder().encode(await moodleXml(selected,level,wave))})}}
  update(total,total,"Création du ZIP…");const archive=await zip(entries),safe=bankSeed.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9_-]+/gi,"-").slice(0,40)||"banque";download(archive,`oscillo-banque-${total}-${safe}-${includePng?"webp-png":"webp"}.zip`);status.textContent=`${total} WebP${includePng?` et ${total} PNG`:""}, le corrigé, l’inventaire et les banques Moodle ont été générés.`;status.className="status success";progressLabel.textContent="Terminé";
}

function showPreview(wave="sinus"){
  if(!image.complete||!image.naturalWidth)return;
  const level=document.querySelector('input[name="previewLevel"]:checked').value;
  const e=exercise(level,`${$("seed").value}|preview|${Date.now()}`,1,new Set(),wave);validateExercise(e);render(e,preview);
  const d=[["Signal",{sinus:"Sinus",triangle:"Triangle",carre:"Carré"}[wave]],["Niveau",level],["V/div",`${num(e.vd)} V`],["s/div",`${num(e.td)} s`],["Umax",`${num(e.umax)} V`],["T",`${num(e.T)} s`],["f",`${num(e.f)} Hz`]];
  if(wave==="carre")d.push(["D",`${num(e.D)} %`]);else d.push(["Umoy",`${num(e.umoy)} V`]);
  previewData.replaceChildren(...d.map(([a,b])=>{const w=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=a;dd.textContent=b;w.append(dt,dd);return w}));
}
form.addEventListener("submit",async e=>{e.preventDefault();try{await generate()}catch(err){status.textContent=err instanceof Error?err.message:String(err);status.className="status error"}finally{button.disabled=false}});
document.querySelectorAll("[data-preview-wave]").forEach(control=>control.addEventListener("click",()=>showPreview(control.dataset.previewWave)));
image.complete?showPreview():image.addEventListener("load",()=>showPreview(),{once:true});
