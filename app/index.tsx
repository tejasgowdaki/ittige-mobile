import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function Index() {
  const { signedIn } = useAuth();
  return <Redirect href={signedIn ? "/(app)" : "/sign-in"} />;
}
