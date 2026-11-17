import { redirect } from "next/navigation";

export default function PremiumRedirect() {
  redirect("/welcome#support-project");
}
