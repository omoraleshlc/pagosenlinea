import { BrandingPanel } from "@/components/branding-panel";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <BrandingPanel />
      <LoginForm />
    </main>
  );
}
