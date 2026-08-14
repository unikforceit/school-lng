import { headers } from "next/headers";
import { redirect } from "next/navigation";
import IdCard from "@/components/IdCard";
import { getSession } from "@/lib/auth";
import { buildIdCardData,safeRequestOrigin } from "@/lib/id-card-data";

export default async function PlatformIdCardPage(){
  const session=await getSession();if(!session)redirect("/superadmin/sign-in");if(session.role!=="superadmin")redirect(`/${session.role}`);
  const requestHeaders=await headers();
  return <IdCard {...await buildIdCardData(session,safeRequestOrigin(requestHeaders))}/>;
}
