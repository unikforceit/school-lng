import { redirect } from "next/navigation";
import EditableProfile from "@/components/EditableProfile";
import { getSession } from "@/lib/auth";

export default async function SuperadminProfilePage(){
  const session=await getSession();
  if(!session)redirect("/superadmin/sign-in");
  if(session.role!=="superadmin")redirect(`/${session.role}`);
  return <EditableProfile fallback={{displayName:session.name,email:session.userId,role:session.role,tenantId:session.tenantId}}/>;
}
