import { BrandingPanel } from "@/components/branding-panel";
import { LoginForm } from "@/components/login-form";

/** Auth shell aligned with pagos AuthLayout / sima_template: form left, brand+logo right. */
export default function LoginPage() {
  return (
    <main className="login-shell">
      <LoginForm />
      <BrandingPanel />
    </main>
  );
}
