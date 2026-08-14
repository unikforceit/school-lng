import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import EditableProfile from "@/components/EditableProfile";
export default async function ProfilePage() {
  const session = await getSession();
  if(!session)redirect("/sign-in");
  return <EditableProfile fallback={{displayName:session.name,email:session.userId,role:session.role,tenantId:session.tenantId}}/>;
}
