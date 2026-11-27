import { Firestore } from "@google-cloud/firestore";

const EMBEDDING_MODEL=process.env.GEMINI_EMBEDDING_MODEL||"gemini-embedding-001";
const EMBEDDING_DIMENSIONS=768;
let firestoreClient;

function getServiceAccount(){
 const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 if(!raw)throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");
 let account;
 try{account=JSON.parse(raw);}catch{throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");}
 if(!account.project_id||!account.client_email||!account.private_key)throw new Error("Firebase service account JSON is missing project_id, client_email, or private_key.");
 return account;
}
export function getFirestore(){
 if(firestoreClient)return firestoreClient;
 const account=getServiceAccount();
 if(process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_PROJECT_ID!==account.project_id)throw new Error("FIREBASE_PROJECT_ID does not match the service-account project.");
 firestoreClient=new Firestore({projectId:account.project_id,credentials:{client_email:account.client_email,private_key:account.private_key}});
 return firestoreClient;
}
export async function createEmbedding(text,taskType="RETRIEVAL_QUERY"){
 const key=process.env.GEMINI_API_KEY;
 if(!key)throw new Error("GEMINI_API_KEY is not configured.");
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(EMBEDDING_MODEL)}:embedContent?key=${encodeURIComponent(key)}`,{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({model:`models/${EMBEDDING_MODEL}`,content:{parts:[{text}]},taskType,outputDimensionality:EMBEDDING_DIMENSIONS})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok){const message=result.error?.message||`Embedding API returned HTTP ${response.status}`;const error=new Error(message);error.status=response.status;throw error;}
 const values=result.embedding?.values;
 if(!Array.isArray(values)||values.length!==EMBEDDING_DIMENSIONS||values.some(value=>!Number.isFinite(value)))throw new Error("Gemini returned an invalid embedding vector.");
 return values;
}
export async function retrieveKnowledge(query,limit=5){
 const vector=await createEmbedding(query,"RETRIEVAL_QUERY");
 const collection=getFirestore().collection("assistant_knowledge_chunks");
 const snapshot=await collection.findNearest({vectorField:"embedding",queryVector:vector,limit,distanceMeasure:"COSINE",distanceResultField:"vectorDistance"}).get();
 return snapshot.docs.map(doc=>{
  const data=doc.data();
  return {id:doc.id,text:data.text||"",title:data.title||"BitSecure documentation",heading:data.heading||"",sourcePath:data.sourcePath||"",domain:data.domain||"platform",distance:typeof data.vectorDistance==="number"?data.vectorDistance:null};
 }).filter(item=>item.text&&item.sourcePath);
}
