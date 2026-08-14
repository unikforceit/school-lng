import { headers } from "next/headers";
import { redirect } from "next/navigation";
import IdCard from "@/components/IdCard";
import { getSession } from "@/lib/auth";
import { buildIdCardData,safeRequestOrigin } from "@/lib/id-card-data";
import { isIdCardSigningConfigured } from "@/lib/id-card";
import IdCardConfigurationError from "@/components/IdCardConfigurationError";

export default async function IdCardPage(){
  const session=await getSession();if(!session)redirect("/sign-in");if(session.role==="superadmin")redirect("/superadmin/id-card");
  if(!isIdCardSigningConfigured())return <IdCardConfigurationError/>;
  const requestHeaders=await headers();
  return <IdCard {...await buildIdCardData(session,safeRequestOrigin(requestHeaders))}/>;
}
