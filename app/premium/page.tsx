import { cookies } from "next/headers";
import { PremiumGateway } from "@/components/plans/premium-gateway";
import { verifySession } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export default async function PremiumPage() {
  const store = await cookies();
  const signedIn = Boolean(verifySession(store.get("aura_session")?.value));
  return <PremiumGateway signedIn={signedIn} />;
}
