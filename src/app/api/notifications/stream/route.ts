import { getSession } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { latestNotificationId } from "@/lib/notifications";

export const dynamic="force-dynamic";export const runtime="nodejs";
export async function GET(request:Request){
 const session=await getSession();if(!session)return jsonError("Authentication required",401);
 const encoder=new TextEncoder();let last=Math.max(Number(new URL(request.url).searchParams.get("after")||0),Number(request.headers.get("last-event-id")||0)),timer:ReturnType<typeof setInterval>|undefined,closed=false;
 const stream=new ReadableStream({start(controller){const push=()=>{if(closed)return;try{const id=latestNotificationId(session);if(id>last){last=id;controller.enqueue(encoder.encode(`id: ${id}\nevent: notification\ndata: ${JSON.stringify({id})}\n\n`))}else controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`))}catch{closed=true;if(timer)clearInterval(timer);controller.close()}};push();timer=setInterval(push,2000);request.signal.addEventListener("abort",()=>{closed=true;if(timer)clearInterval(timer);try{controller.close()}catch{}},{once:true})},cancel(){closed=true;if(timer)clearInterval(timer)}});
 return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"}})
}
