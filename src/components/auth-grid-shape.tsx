import Image from "next/image";

/** Decorative grids from sima_template AuthGridShape. */
export function AuthGridShape() {
  return (
    <div className="auth-grid-shape" aria-hidden>
      <div className="auth-grid-shape-top">
        <Image
          src="/images/shape/grid-01.svg"
          alt=""
          width={450}
          height={450}
          unoptimized
        />
      </div>
      <div className="auth-grid-shape-bottom">
        <Image
          src="/images/shape/grid-01.svg"
          alt=""
          width={450}
          height={450}
          unoptimized
        />
      </div>
    </div>
  );
}
