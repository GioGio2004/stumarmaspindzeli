import { SignIn } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

export default function SignInPage() {
  return (
    <AuthFrame title="Every request, handled by the" mark="right person">
      <SignIn />
    </AuthFrame>
  );
}
