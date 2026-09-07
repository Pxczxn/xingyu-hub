import { redirect } from "next/navigation";

export default function LegacyHotPage() {
  redirect("/discover?sort=hot");
}
