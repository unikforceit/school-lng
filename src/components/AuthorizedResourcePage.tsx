import { getSession } from "@/lib/auth";
import { canReadResource, type ResourceType } from "@/lib/resources";
import { redirect } from "next/navigation";
import ResourceManager from "@/components/ResourceManager";

export default async function AuthorizedResourcePage({ type }: { type: ResourceType }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!canReadResource(session.role, type)) redirect(`/${session.role}`);
  return <ResourceManager type={type} />;
}
