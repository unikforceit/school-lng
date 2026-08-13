import PlatformConsolePages from "@/components/PlatformConsolePages";
export default async function Page({params}:{params:Promise<{id:string}>}){return <PlatformConsolePages kind="school" schoolId={(await params).id}/>}
