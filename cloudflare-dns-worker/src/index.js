import { connect } from "cloudflare:sockets";

const ROOTS = ["198.41.0.4","199.9.14.201","192.33.4.12","199.7.91.13","192.203.230.10","192.5.5.241","192.112.36.4","198.97.190.53","192.36.148.17","192.58.128.30","193.0.14.129","199.7.83.42","202.12.27.33"];
const TYPES = { A:1, NS:2, CNAME:5, SOA:6, MX:15, TXT:16, AAAA:28, CAA:257 };
const TYPE_NAMES = Object.fromEntries(Object.entries(TYPES).map(([k,v])=>[v,k]));
const enc = new TextEncoder();
const dec = new TextDecoder();
const MAX_AMOUNT_PAISE = 10000000;
const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function nameBytes(name) {
  const out=[];
  for (const label of name.replace(/\.$/,"").split(".")) {
    const b=enc.encode(label);
    if (!b.length || b.length>63) throw new Error("Invalid DNS label");
    out.push(b.length,...b);
  }
  out.push(0); return out;
}
function makeQuery(name,type,id) {
  return Uint8Array.from([id>>8,id&255,0,0,0,1,0,0,0,0,0,0,...nameBytes(name),TYPES[type]>>8,TYPES[type]&255,0,1]);
}
function u16(b,o){return (b[o]<<8)|b[o+1]}
function u32(b,o){return (b[o]*16777216)+(b[o+1]<<16)+(b[o+2]<<8)+b[o+3]}
function readName(b,start) {
  let p=start, jumped=false, end=start, hops=0; const labels=[];
  while(p<b.length && hops++<80) {
    const n=b[p];
    if(n===0){p++;if(!jumped)end=p;break;}
    if((n&192)===192){if(p+1>=b.length)throw new Error("Malformed DNS compression pointer");const target=((n&63)<<8)|b[p+1];if(!jumped)end=p+2;jumped=true;p=target;continue;}
    if(n&192) throw new Error("Unsupported DNS label encoding");
    if(p+1+n>b.length) throw new Error("Truncated DNS name");
    labels.push(dec.decode(b.slice(p+1,p+1+n)));p+=1+n;
  }
  if(hops>=80) throw new Error("DNS compression loop");
  return {name:labels.join("."),next:jumped?end:p};
}
function parseMessage(b) {
  if(b.length<12) throw new Error("Short DNS response");
  const flags=u16(b,2), qd=u16(b,4), an=u16(b,6), ns=u16(b,8), ar=u16(b,10);
  let p=12;
  for(let i=0;i<qd;i++){p=readName(b,p).next+4;}
  const sections={answer:[],authority:[],additional:[]};
  const parseRR=(target,count)=>{
    for(let i=0;i<count;i++){
      const n=readName(b,p);p=n.next;
      if(p+10>b.length)throw new Error("Truncated DNS resource record");
      const type=u16(b,p), klass=u16(b,p+2), ttl=u32(b,p+4), len=u16(b,p+8);p+=10;
      const start=p,end=p+len;if(end>b.length)throw new Error("Truncated DNS record data");
      let data;
      if(type===1 && len===4) data=[...b.slice(start,end)].join(".");
      else if(type===28 && len===16){const parts=[];for(let j=0;j<16;j+=2)parts.push(u16(b,start+j).toString(16));data=parts.join(":");}
      else if([2,5].includes(type)) data=readName(b,start).name;
      else if(type===15) data={priority:u16(b,start),exchange:readName(b,start+2).name};
      else if(type===16){const chunks=[];let q=start;while(q<end){const l=b[q++];chunks.push(dec.decode(b.slice(q,q+l)));q+=l;}data=chunks.join("");}
      else if(type===6){const m=readName(b,start),r=readName(b,m.next);data={mname:m.name,rname:r.name,serial:u32(b,r.next),refresh:u32(b,r.next+4),retry:u32(b,r.next+8),expire:u32(b,r.next+12),minimum:u32(b,r.next+16)};}
      else if(type===257 && len>=2)data={flags:b[start],tag:dec.decode(b.slice(start+1,start+2)),value:dec.decode(b.slice(start+2,end))};
      else data="0x"+[...b.slice(start,end)].map(x=>x.toString(16).padStart(2,"0")).join("");
      target.push({name:n.name,type:TYPE_NAMES[type]||type,ttl,class:klass===1?"IN":klass,data});
      p=end;
    }
  };
  parseRR(sections.answer,an);parseRR(sections.authority,ns);parseRR(sections.additional,ar);
  return {rcode:flags&15,aa:!!(flags&0x0400),answers:sections.answer,authority:sections.authority,additional:sections.additional};
}
function publicIPv4(ip) {
  const a=ip.split(".").map(Number);if(a.length!==4||a.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const [x,y]=a;
  return !(x===0||x===10||x===127||x>=224||(x===169&&y===254)||(x===172&&y>=16&&y<=31)||(x===192&&y===168)||(x===100&&y>=64&&y<=127)||(x===192&&y===0));
}
async function tcpDns(ip,query) {
  if(!publicIPv4(ip)) throw new Error("Refusing a non-public DNS server address");
  const socket=connect({hostname:ip,port:53},{secureTransport:"off"});
  try {
    await Promise.race([socket.opened,new Promise((_,rej)=>setTimeout(()=>rej(new Error("DNS connection timeout")),4500))]);
    const writer=socket.writable.getWriter();
    const packet=new Uint8Array(query.length+2);packet[0]=query.length>>8;packet[1]=query.length&255;packet.set(query,2);
    await writer.write(packet);writer.releaseLock();
    const reader=socket.readable.getReader();let buf=new Uint8Array(0),needed=null;
    const deadline=Date.now()+5000;
    while(Date.now()<deadline) {
      const next=await Promise.race([reader.read(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("DNS response timeout")),Math.max(1,deadline-Date.now())))]);
      if(next.done)break;
      const joined=new Uint8Array(buf.length+next.value.length);joined.set(buf);joined.set(next.value,buf.length);buf=joined;
      if(needed===null&&buf.length>=2)needed=u16(buf,0)+2;
      if(needed!==null&&buf.length>=needed)return buf.slice(2,needed);
    }
    throw new Error("DNS server closed the connection before replying");
  } finally { try{await socket.close();}catch{} }
}
function pickNsIp(message) {
  const ns=message.authority.find(r=>r.type==="NS");
  if(!ns)return null;
  const glue=message.additional.find(r=>r.type==="A"&&r.name.toLowerCase()===String(ns.data).toLowerCase()&&publicIPv4(r.data));
  return glue?{host:ns.data,ip:glue.data}:null;
}
async function traceLookup(name,type) {
  const steps=[];let current=name,answers=[],allAnswers=[],server=ROOTS[0],rcode=0;
  for(let alias=0;alias<6;alias++) {
    let stage="root";
    for(let depth=0;depth<3;depth++) {
      const started=Date.now(),packet=makeQuery(current,type,Math.floor(Math.random()*65536));
      const msg=parseMessage(await tcpDns(server,packet));
      const elapsed=Date.now()-started;
      steps.push({stage,server,query:current+" "+type,elapsedMs:elapsed,rcode:msg.rcode,authoritative:msg.aa,answers:msg.answers,referrals:msg.authority.filter(x=>x.type==="NS"),glue:msg.additional.filter(x=>x.type==="A"||x.type==="AAAA")});
      rcode=msg.rcode;
      if(msg.rcode!==0){answers=msg.answers;break;}
      if(msg.answers.length){answers=msg.answers;break;}
      const referral=pickNsIp(msg);
      if(!referral) {
        if(stage==="authoritative"){answers=msg.answers;break;}
        throw new Error("The DNS server did not return an IPv4 glue address for its referral. Try another domain or query type.");
      }
      server=referral.ip;stage=depth===0?"tld":"authoritative";
    }
    const cname=answers.find(x=>x.type==="CNAME");
    if(!cname||type==="CNAME"||rcode!==0){allAnswers.push(...answers);break;}
    allAnswers.push(cname);current=String(cname.data);answers=[];server=ROOTS[0];
  }
  return {name,type,rcode,steps,answers:allAnswers.length?allAnswers:answers,queriedAt:new Date().toISOString(),method:"Direct iterative DNS over TCP/53"};
}
function validName(value) {
  const name=String(value||"").trim().toLowerCase().replace(/\.$/,"");
  if(name.length>253||!name||name.includes("://")||name.includes("/")||name.split(".").some(l=>!l||l.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l)))return null;
  return name;
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "").split(",").map(x=>x.trim()).filter(Boolean);
  const allowOrigin = allowed.includes("*") ? "*" : (allowed.includes(origin) ? origin : "null");
  return {"Access-Control-Allow-Origin":allowOrigin,"Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, x-razorpay-signature, x-razorpay-event-id","Vary":"Origin"};
}
function jsonResponse(data,status,headers) {
  return Response.json(data,{status:status||200,headers:{...headers,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
function bytesToHex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");}
async function hmacHex(secret,message) {
  const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return bytesToHex(await crypto.subtle.sign("HMAC",key,enc.encode(message)));
}
function secureEqualHex(a,b) {
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length||!/^[a-f0-9]+$/i.test(a)||!/^[a-f0-9]+$/i.test(b))return false;
  let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;
}
async function razorpayRequest(env,path,method="GET",body) {
  if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)throw new Error("Razorpay is not configured.");
  const headers={Authorization:"Basic "+btoa(env.RAZORPAY_KEY_ID+":"+env.RAZORPAY_KEY_SECRET)};
  if(body)headers["Content-Type"]="application/json";
  const response=await fetch("https://api.razorpay.com/v1/"+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error?.description||"Razorpay API request failed.");
  return data;
}
function projectId(env){return env.FIREBASE_PROJECT_ID||"bit-7ce8a";}
function firestoreDocUrl(env,path){return FIRESTORE_ROOT+"/projects/"+encodeURIComponent(projectId(env))+"/databases/(default)/documents/"+path;}
function b64url(input) {
  const bytes=typeof input==="string"?enc.encode(input):new Uint8Array(input);
  let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
async function firestoreAccessToken(env) {
  if(!env.FIREBASE_CLIENT_EMAIL||!env.FIREBASE_PRIVATE_KEY)throw new Error("Firebase service account secrets are not configured.");
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claims=b64url(JSON.stringify({iss:env.FIREBASE_CLIENT_EMAIL,scope:"https://www.googleapis.com/auth/datastore",aud:TOKEN_ENDPOINT,iat:now,exp:now+3600}));
  const unsigned=header+"."+claims;
  const pem=env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
  const binary=atob(pem);const der=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey("pkcs8",der,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(unsigned));
  const assertion=unsigned+"."+b64url(signature);
  const response=await fetch(TOKEN_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token)throw new Error("Unable to obtain Firebase service access token.");
  return data.access_token;
}
async function firestoreRequest(env,path,method="GET",body,query="") {
  const token=await firestoreAccessToken(env);
  const response=await fetch(firestoreDocUrl(env,path)+query,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  if(response.status===404)return null;
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error?.message||"Firestore request failed.");
  return data;
}
function fsString(value){return {stringValue:String(value??"")};}
function fsInteger(value){return {integerValue:String(Math.trunc(Number(value)||0))};}
function fsTimestamp(value){return {timestampValue:value||new Date().toISOString()};}
function contributionFields(item) {
  const fields={amount:fsInteger(item.amount),refundedAmount:fsInteger(item.refundedAmount||0),currency:fsString("INR"),method:fsString("razorpay"),status:fsString(item.status),orderId:fsString(item.orderId),paymentId:fsString(item.paymentId||""),createdAt:fsTimestamp(item.createdAt),email:fsString(item.email||""),userId:fsString(item.userId||"")};
  if(item.verifiedAt)fields.verifiedAt=fsTimestamp(item.verifiedAt);
  return fields;
}
function fromFirestore(doc) {
  const f=doc.fields||{},get=k=>f[k]?.stringValue??"",num=k=>Number(f[k]?.integerValue||0);
  return {id:doc.name?.split("/").pop(),amount:num("amount"),refundedAmount:num("refundedAmount"),currency:get("currency"),method:get("method"),status:get("status"),orderId:get("orderId"),paymentId:get("paymentId"),createdAt:f.createdAt?.timestampValue||"",verifiedAt:f.verifiedAt?.timestampValue||""};
}
async function saveContribution(env,item,create=false) {
  const path="contributions/"+encodeURIComponent(item.orderId);
  const fields=contributionFields(item);
  if(create) {
    return firestoreRequest(env,"contributions","POST",{fields},"?documentId="+encodeURIComponent(item.orderId));
  }
  const mask=Object.keys(fields).map(k=>"updateMask.fieldPaths="+encodeURIComponent(k)).join("&");
  return firestoreRequest(env,path,"PATCH",{fields},"?"+mask);
}
async function findContribution(env,orderId) {
  if(!/^[A-Za-z0-9_-]{5,80}$/.test(String(orderId||"")))return null;
  const doc=await firestoreRequest(env,"contributions/"+encodeURIComponent(orderId));
  return doc?fromFirestore(doc):null;
}
async function createRazorpayOrder(request,env,headers) {
  if(!env.RAZORPAY_KEY_ID||!env.RAZORPAY_KEY_SECRET)return jsonResponse({error:"Payment service is not configured."},503,headers);
  let body;try{body=await request.json();}catch{return jsonResponse({error:"Request body must be valid JSON."},400,headers);}
  const amount=Number(body?.amount);
  if(!Number.isSafeInteger(amount)||amount<100||amount>MAX_AMOUNT_PAISE)return jsonResponse({error:"Contribution must be between ₹1 and ₹1,00,000."},400,headers);
  try {
    const order=await razorpayRequest(env,"orders","POST",{amount,currency:"INR",receipt:"bs_"+crypto.randomUUID().replace(/-/g,"").slice(0,20),notes:{source:"BitSecure Support Us"}});
    const item={amount,orderId:order.id,status:"created",createdAt:new Date().toISOString(),email:"",userId:""};
    await saveContribution(env,item,true);
    return jsonResponse({order_id:order.id,amount:order.amount,currency:order.currency,key_id:env.RAZORPAY_KEY_ID},200,headers);
  } catch(error){return jsonResponse({error:error.message||"Unable to create payment order."},502,headers);}
}
async function verifyRazorpayPayment(request,env,headers) {
  let body;try{body=await request.json();}catch{return jsonResponse({error:"Request body must be valid JSON."},400,headers);}
  const {razorpay_order_id:orderId,razorpay_payment_id:paymentId,razorpay_signature:signature}=body||{};
  if(![orderId,paymentId,signature].every(v=>typeof v==="string"&&v.trim()))return jsonResponse({error:"Razorpay payment details are required."},400,headers);
  try {
    const expected=await hmacHex(env.RAZORPAY_KEY_SECRET,orderId+"|"+paymentId);
    if(!secureEqualHex(expected,signature))return jsonResponse({verified:false,error:"Payment signature verification failed."},400,headers);
    const contribution=await findContribution(env,orderId);
    if(!contribution)return jsonResponse({verified:false,error:"This order was not created by BitSecure."},404,headers);
    if(contribution.paymentId&&contribution.paymentId!==paymentId)return jsonResponse({verified:false,error:"This order is already linked to another payment."},409,headers);
    const payment=await razorpayRequest(env,"payments/"+encodeURIComponent(paymentId));
    if(payment.order_id!==orderId||Number(payment.amount)!==contribution.amount||payment.currency!=="INR")return jsonResponse({verified:false,error:"Payment details do not match the original order."},409,headers);
    if(payment.status!=="captured")return jsonResponse({verified:false,status:payment.status,error:"Payment is not captured yet. The webhook will reconcile its final status."},409,headers);
    await saveContribution(env,{...contribution,orderId,paymentId,status:"captured",verifiedAt:new Date().toISOString()});
    return jsonResponse({verified:true,status:"captured",order_id:orderId,payment_id:paymentId},200,headers);
  } catch(error){return jsonResponse({verified:false,error:error.message||"Unable to verify payment."},502,headers);}
}
async function handleWebhook(request,env,headers) {
  if(!env.RAZORPAY_WEBHOOK_SECRET)return jsonResponse({error:"Webhook is not configured."},503,headers);
  const raw=await request.text();
  const signature=request.headers.get("x-razorpay-signature")||"";
  const expected=await hmacHex(env.RAZORPAY_WEBHOOK_SECRET,raw);
  if(!secureEqualHex(expected,signature))return jsonResponse({error:"Invalid webhook signature."},401,headers);
  let event;try{event=JSON.parse(raw);}catch{return jsonResponse({error:"Invalid webhook payload."},400,headers);}
  const eventId=request.headers.get("x-razorpay-event-id")||"";
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(eventId))return jsonResponse({error:"A valid Razorpay event identifier is required."},400,headers);
  const payment=event.payload?.payment?.entity;
  if(!["payment.captured","payment.failed","refund.processed"].includes(event.event))return jsonResponse({received:true,ignored:true},200,headers);
  const refund=event.event==="refund.processed"?event.payload?.refund?.entity:null;
  let orderPayment=payment;
  if(event.event==="refund.processed") {
    if(!refund?.payment_id)return jsonResponse({received:true,ignored:true},200,headers);
    orderPayment=await razorpayRequest(env,"payments/"+encodeURIComponent(refund.payment_id));
  }
  if(!orderPayment?.order_id)return jsonResponse({received:true,ignored:true},200,headers);
  const contribution=await findContribution(env,orderPayment.order_id);
  if(!contribution)return jsonResponse({received:true,ignored:true},200,headers);
  if(Number(orderPayment.amount)!==contribution.amount||orderPayment.currency!=="INR")return jsonResponse({error:"Webhook amount does not match the original contribution."},409,headers);
  if(eventId) {
    const seen=await firestoreRequest(env,"paymentWebhookEvents/"+encodeURIComponent(eventId));
    if(seen)return jsonResponse({received:true,duplicate:true},200,headers);
  }
  if(["captured","partially_refunded","refunded"].includes(contribution.status)&&event.event==="payment.failed")return jsonResponse({received:true,ignored:true},200,headers);
  if(["refunded","partially_refunded"].includes(contribution.status)&&event.event==="payment.captured")return jsonResponse({received:true,ignored:true},200,headers);
  let refundedAmount=Number(contribution.refundedAmount)||0;
  if(event.event==="refund.processed") {
    const refundAmount=Number(refund?.amount);
    if(!Number.isSafeInteger(refundAmount)||refundAmount<1)return jsonResponse({error:"Invalid refund amount."},400,headers);
    refundedAmount=Math.min(contribution.amount,refundedAmount+refundAmount);
  }
  const status=event.event==="payment.captured"?"captured":event.event==="refund.processed"?(refundedAmount>=contribution.amount?"refunded":"partially_refunded"):"failed";
  await saveContribution(env,{...contribution,paymentId:orderPayment.id||contribution.paymentId,refundedAmount,status,verifiedAt:["captured","partially_refunded","refunded"].includes(status)?new Date().toISOString():contribution.verifiedAt});
  if(eventId) {
    await firestoreRequest(env,"paymentWebhookEvents","POST",{fields:{event:fsString(event.event),processedAt:fsTimestamp(new Date().toISOString())}},"?documentId="+encodeURIComponent(eventId));
  }
  return jsonResponse({received:true},200,headers);
}
async function verifyFirebaseUser(request,env) {
  const auth=request.headers.get("Authorization")||"";
  const match=auth.match(/^Bearer\s+(.+)$/i);
  if(!match||!env.FIREBASE_WEB_API_KEY)return null;
  const response=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:match[1]})});
  if(!response.ok)return null;
  const data=await response.json().catch(()=>({}));
  return data.users?.[0]?.localId||null;
}
async function adminContributions(request,env,headers) {
  const uid=await verifyFirebaseUser(request,env);
  const allowed=(env.ADMIN_UIDS||"").split(",").map(x=>x.trim()).filter(Boolean);
  if(!uid||!allowed.includes(uid))return jsonResponse({error:"Administrator access is required."},403,headers);
  try {
    const data=await firestoreRequest(env,"contributions","GET",null,"?pageSize=100");
    const contributions=(data?.documents||[]).map(fromFirestore).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    return jsonResponse({contributions},200,headers);
  } catch(error){return jsonResponse({error:error.message||"Unable to load contributions."},502,headers);}
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),cors=corsHeaders(request,env||{});
    if(request.method==="OPTIONS")return new Response(null,{headers:cors});
    if(url.pathname==="/api/create-order")return request.method==="POST"?createRazorpayOrder(request,env||{},cors):jsonResponse({error:"Method not allowed."},405,cors);
    if(url.pathname==="/api/verify-payment")return request.method==="POST"?verifyRazorpayPayment(request,env||{},cors):jsonResponse({error:"Method not allowed."},405,cors);
    if(url.pathname==="/api/razorpay-webhook")return request.method==="POST"?handleWebhook(request,env||{},cors):jsonResponse({error:"Method not allowed."},405,cors);
    if(url.pathname==="/api/admin/contributions")return request.method==="GET"?adminContributions(request,env||{},cors):jsonResponse({error:"Method not allowed."},405,cors);
    if(url.pathname==="/health")return jsonResponse({ok:true,service:"DC_Project DNS and Razorpay API"},200,cors);
    if(url.pathname!=="/trace")return jsonResponse({error:"Use /trace?name=example.com&type=A or the /api payment routes."},404,cors);
    const name=validName(url.searchParams.get("name")),type=(url.searchParams.get("type")||"A").toUpperCase();
    if(!name||!TYPES[type])return jsonResponse({error:"Enter a valid public domain and a supported record type."},400,cors);
    try{return jsonResponse(await traceLookup(name,type),200,cors);}
    catch(error){return jsonResponse({error:error?.message||"DNS lookup failed",hint:"The hosting provider or destination DNS server may block outbound TCP port 53."},502,cors);}
  }
};
