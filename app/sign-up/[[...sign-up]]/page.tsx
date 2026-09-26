import { SignUp } from "@clerk/nextjs";
import { AuthFrame } from "@/components/auth-frame";

export default function SignUpPage() {
  return (
    <AuthFrame title="Run your hotel from" mark="one place">
      <SignUp />
    </AuthFrame>
  );
}
