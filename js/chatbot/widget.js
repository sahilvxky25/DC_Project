/* Authenticated BitSecure Assistant client. The server verifies every Firebase ID token. */
import { auth } from "../auth/firebase-client.js";
const launcher=document.querySelector("#chatbotLauncher"),panel=document.querySelector("#chatbotPanel"),closeButton=document.querySelector("#chatbotClose");
const form=document.querySelector("#chatbotForm"),input=document.querySelector("#chatbotInput"),messages=document.querySelector("#chatbotMessages");
const status=document.querySelector("#chatbotStatus"),sendButton=document.querySelector("#chatbotSend"),newChatButton=document.querySelector("#chatbotNewChat");
const MAX_HISTORY=10;let history=[],sending=false;
function setOpen(open){panel.hidden=!open;launcher.setAttribute("aria-expanded",String(open));launcher.setAttribute("aria-label",open?"Close BitSecure assistant":"Open BitSecure assistant");if(open)input.focus();else launcher.focus();}
function addMessage(role,text){const article=document.createElement("article");article.className=`chatbot-message ${role}`;const bubble=document.createElement("div");bubble.className="chatbot-message-bubble";bubble.textContent=text;article.append(bubble);messages.append(article);messages.scrollTop=messages.scrollHeight;}
function setBusy(busy,label=""){sending=busy;sendButton.disabled=busy;input.disabled=busy;newChatButton.disabled=busy;status.textContent=label;}
function resetChat(){history=[];messages.replaceChildren();addMessage("assistant","Hi! I’m your BitSecure Assistant. Ask me about networking concepts, protocols, calculations, or how to use this learning platform.");status.textContent="";input.focus();}
async function sendMessage(text){const user=auth.currentUser;if(!user){status.textContent="Your session has expired. Please sign in again.";return;}const clean=text.trim();if(!clean||sending)return;addMessage("user",clean);history.push({role:"user",content:clean});input.value="";setBusy(true,"Thinking…");
try{const token=await user.getIdToken();const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify({messages:(()=>{const recent=history.slice(-MAX_HISTORY);if(recent[0]?.role==="assistant")recent.shift();return recent;})()})});const payload=await response.json().catch(()=>({}));
if(response.status===401){await user.getIdToken(true).catch(()=>null);throw new Error("Your sign-in session expired. Please sign out and sign in again.");}
if(!response.ok)throw new Error(payload.error||"The assistant could not respond. Please try again.");if(typeof payload.reply!=="string"||!payload.reply.trim())throw new Error("The assistant returned an empty response. Please try again.");
history.push({role:"assistant",content:payload.reply});history=history.slice(-MAX_HISTORY);addMessage("assistant",payload.reply);setBusy(false,"");
}catch(error){history.pop();setBusy(false,error.message||"Something went wrong. Please try again.");}
finally{input.disabled=false;sendButton.disabled=false;input.focus();}}
if(launcher&&panel&&closeButton&&form&&input&&messages&&status&&sendButton&&newChatButton){
launcher.addEventListener("click",()=>setOpen(panel.hidden));closeButton.addEventListener("click",()=>setOpen(false));
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!panel.hidden)setOpen(false);});
form.addEventListener("submit",event=>{event.preventDefault();sendMessage(input.value);});
input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();form.requestSubmit();}});
newChatButton.addEventListener("click",resetChat);
auth.onAuthStateChanged(user=>{if(!user){history=[];messages.replaceChildren();status.textContent="Sign in to use the assistant.";setOpen(false);}});
}
