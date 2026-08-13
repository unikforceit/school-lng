"use client";
import { useCallback,useEffect,useState } from "react";
export type SageAction={tool:string;ok:boolean;message:string;href?:string;recordId?:number};
export type SageMessage={id?:number;role:"user"|"assistant";content:string;model?:string;actions?:SageAction[];createdAt?:string};
export type SageConversation={id:string;title:string;createdAt:string;updatedAt:string};
async function api(path:string,init?:RequestInit){const response=await fetch(path,{cache:"no-store",...init}),payload=response.status===204?null:await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"SAGE request failed");return payload?.data}
export function useSageChat(){
 const [conversations,setConversations]=useState<SageConversation[]>([]),[conversationId,setConversationId]=useState<string|null>(null),[messages,setMessages]=useState<SageMessage[]>([]),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState("");
 const refresh=useCallback(async(selectLatest=false)=>{const rows=await api("/api/ai/conversations") as SageConversation[];setConversations(rows);if(selectLatest&&!conversationId&&rows[0])setConversationId(rows[0].id);return rows},[conversationId]);
 const select=useCallback(async(id:string)=>{setConversationId(id);setLoading(true);setError("");try{const data=await api(`/api/ai/conversations/${id}`);setMessages(data.messages||[])}catch(cause){setError(cause instanceof Error?cause.message:"Unable to load conversation")}finally{setLoading(false)}},[]);
 useEffect(()=>{let active=true;void api("/api/ai/conversations").then((rows:SageConversation[])=>{if(!active)return;setConversations(rows);if(rows[0])return select(rows[0].id);setLoading(false)}).catch(cause=>{if(active){setError(cause instanceof Error?cause.message:"Unable to load history");setLoading(false)}});return()=>{active=false}},[select]);
 async function send(prompt:string){const content=prompt.trim();if(content.length<3||sending)return false;setError("");setSending(true);setMessages(current=>[...current,{role:"user",content}]);try{const data=await api("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:content,...(conversationId?{conversationId}:{})})});setConversationId(data.conversationId);setMessages(current=>[...current,{id:data.messageId,role:"assistant",content:data.answer,model:data.model,actions:data.actions||[]}]);await refresh();window.dispatchEvent(new CustomEvent("sage-history-changed",{detail:{conversationId:data.conversationId}}));return true}catch(cause){setMessages(current=>current.filter((_,index)=>index!==current.length-1));setError(cause instanceof Error?cause.message:"SAGE could not respond");return false}finally{setSending(false)}}
 function newChat(){setConversationId(null);setMessages([]);setError("");setLoading(false)}
 async function remove(id=conversationId){if(!id)return;await api(`/api/ai/conversations/${id}`,{method:"DELETE"});const rows=await refresh();const next=rows.find(row=>row.id!==id);if(next)await select(next.id);else newChat()}
 async function clearAll(){await api("/api/ai/conversations",{method:"DELETE"});setConversations([]);newChat();window.dispatchEvent(new CustomEvent("sage-history-changed"))}
 return {conversations,conversationId,messages,loading,sending,error,setError,send,newChat,select,remove,clearAll,refresh};
}
