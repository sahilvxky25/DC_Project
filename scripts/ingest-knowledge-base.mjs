import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue, Firestore } from "@google-cloud/firestore";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const SOURCE_DIR=path.join(ROOT,"docs","ai-knowledge-base");
const COLLECTION="assistant_knowledge_chunks";
const DIMENSIONS=768;
const MODEL=process.env.GEMINI_EMBEDDING_MODEL||"gemini-embedding-001";
const PAUSE_MS=250;

function accountFromEnv(){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw)throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON to the service-account JSON before running ingestion.");
 const account=JSON.parse(raw);
 if(!account.project_id||!account.client_email||!account.private_key)throw new Error("Service-account JSON is missing project_id, client_email, or private_key.");
 return account;
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function listMarkdown(dir){
 const entries=await readdir(dir,{withFileTypes:true});
 const files=[];
 for(const entry of entries){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())files.push(...await listMarkdown(full));
  else if(entry.isFile()&&entry.name.toLowerCase().endsWith(".md"))files.push(full);
 }
 return files.sort();
}
function titleFrom(markdown,filePath){
 const match=markdown.match(/^#\\s+(.+)$/m);
 return match?.[1]?.trim()||path.basename(filePath,".md");
}
function splitSections(markdown){
 const lines=markdown.replace(/\\r/g,"").split("\\n");
 const sections=[];let heading="Introduction",buffer=[];
 const flush=()=>{const text=buffer.join("\\n").trim();if(text)sections.push({heading,text});buffer=[];};
 for(const line of lines){
  const match=line.match(/^(#{1,6})\\s+(.+)$/);
  if(match){flush();heading=match[2].trim();}else buffer.push(line);
 }
 flush();return sections;
}
function splitText(text,maxChars=1700,overlap=220){
 const paragraphs=text.split(/\\n\\s*\\n/).map(value=>value.trim()).filter(Boolean);
 const chunks=[];let current="";
 for(const paragraph of paragraphs){
  if(paragraph.length>maxChars){
   if(current){chunks.push(current);current="";}
   let start=0;
   while(start<paragraph.length){const end=Math.min(start+maxChars,paragraph.length);chunks.push(paragraph.slice(start,end));if(end===paragraph.length)break;start=Math.max(end-overlap,start+1);}
   continue;
  }
  if(current&&current.length+paragraph.length+2>maxChars){chunks.push(current);const tail=current.slice(-overlap);current=tail?tail+"\\n\\n"+paragraph:paragraph;}
  else current=current?current+"\\n\\n"+paragraph:paragraph;
 }
 if(current.trim())chunks.push(current.trim());
 return chunks;
}
async function embed(text,key){
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:embedContent?key=${encodeURIComponent(key)}`;
 for(let attempt=0;attempt<4;attempt++){
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:`models/${MODEL}`,content:{parts:[{text}]},taskType:"RETRIEVAL_DOCUMENT",outputDimensionality:DIMENSIONS})});
  const result=await response.json().catch(()=>({}));
  if(response.ok){const vector=result.embedding?.values;if(Array.isArray(vector)&&vector.length===DIMENSIONS)return vector;throw new Error("Gemini returned an invalid embedding vector.");}
  if(![429,500,502,503].includes(response.status)||attempt===3)throw new Error(`Embedding failed (HTTP ${response.status}): ${result.error?.message||"unknown error"}`);
  await sleep(1000*2**attempt);
 }
 throw new Error("Embedding retries exhausted.");
}
async function main(){
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error("Set GEMINI_API_KEY before running ingestion.");
 const account=accountFromEnv();
 const db=new Firestore({projectId:account.project_id,credentials:{client_email:account.client_email,private_key:account.private_key}});
 const files=await listMarkdown(SOURCE_DIR);if(!files.length)throw new Error("No Markdown knowledge-base documents were found.");
 let count=0;
 for(const file of files){
  const markdown=await readFile(file,"utf8"),relative=path.relative(ROOT,file).split(path.sep).join("/");
  const title=titleFrom(markdown,relative),domain=relative.split("/")[2]||"platform",sections=splitSections(markdown);
  for(const section of sections){
   const chunks=splitText(section.text);
   for(let index=0;index<chunks.length;index++){
    const text=chunks[index],id=createHash("sha256").update([relative,section.heading,index,text].join("\\n")).digest("hex");
    const vector=await embed(text,key);
    await db.collection(COLLECTION).doc(id).set({
     text,title,heading:section.heading,sourcePath:relative,domain,
     topic:path.basename(relative,".md"),chunkIndex:index,embedding:FieldValue.vector(vector),
     embeddingModel:MODEL,embeddingDimensions:DIMENSIONS,contentHash:createHash("sha256").update(markdown).digest("hex"),
     updatedAt:FieldValue.serverTimestamp()
    });
    count++;console.log(`Indexed ${relative} — ${section.heading} (chunk ${index+1}/${chunks.length})`);
    await sleep(PAUSE_MS);
   }
  }
 }
 console.log(`Completed: indexed ${count} chunks from ${files.length} Markdown files into ${COLLECTION}.`);
 await db.close();
}
main().catch(error=>{console.error("Knowledge-base ingestion failed:",error.message);process.exitCode=1;});
