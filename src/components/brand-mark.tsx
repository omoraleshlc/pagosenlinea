import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  variant?: "stack" | "wordmark" | "icon";
  tone?: "color" | "white";
  size?: "md" | "lg";
  hospital?: string;
  appName?: string;
  href?: string | null;
};

export function BrandMark({
  variant = "stack",
  tone = "color",
  size = "md",
  hospital = "Hospital La Carlota",
  appName = "Pagos en línea",
  href = "/login",
}: BrandMarkProps) {
  const wordmark =
    tone === "white"
      ? "/images/brand/logo-white.png"
      : "/images/brand/logo-color.png";

  let mark;
  if (variant === "icon") {
    mark = (
      <div className="brand-mark brand-mark-icon">
        <Image
          src="/images/brand/logo-icon.png"
          alt=""
          width={36}
          height={36}
          className="brand-mark-img-icon"
        />
      </div>
    );
  } else if (variant === "wordmark") {
    mark = (
      <div className="brand-mark brand-mark-wordmark">
        <Image
          src={wordmark}
          alt={hospital}
          width={size === "lg" ? 280 : 160}
          height={size === "lg" ? 112 : 56}
          className={
            size === "lg" ? "brand-mark-img-wordmark-lg" : "brand-mark-img-wordmark"
          }
          priority
        />
        <p
          className={
            size === "lg"
              ? `brand-mark-appname-lg ${tone === "white" ? "tone-white" : ""}`
              : `brand-mark-appname ${tone === "white" ? "tone-white" : ""}`
          }
        >
          {appName}
        </p>
      </div>
    );
  } else {
    mark = (
      <div className="brand-mark brand-mark-stack">
        <Image
          src="/images/brand/logo-icon.png"
          alt=""
          width={40}
          height={40}
          className="brand-mark-img-icon"
        />
        <div className="brand-mark-text">
          <p className="brand-mark-hospital">{hospital}</p>
          <p className="brand-mark-app">{appName}</p>
        </div>
      </div>
    );
  }

  if (!href) return mark;
  return (
    <Link href={href} className="brand-mark-link">
      {mark}
    </Link>
  );
}
