import { handleLogin } from "@/lib/login";
export async function POST(request:Request){return handleLogin(request,"school")}
