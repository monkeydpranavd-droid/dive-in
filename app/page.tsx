import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="ds-page flex min-h-screen flex-col items-center justify-center">
      <main className="flex w-full max-w-[700px] flex-col items-center gap-8 py-16 px-6 text-center sm:py-24">
        <Image
          className="opacity-80 invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6">
          <h1 className="ds-h1 max-w-xs text-center">
            To get started, edit the page.tsx file.
          </h1>
          <p className="ds-text-muted max-w-md text-center leading-8">
            Looking for a starting point or more instructions? Head over to{" "}
            <Link href="https://vercel.com/templates?framework=next.js" className="ds-link" target="_blank" rel="noopener noreferrer">
              Templates
            </Link>{" "}
            or the{" "}
            <Link href="https://nextjs.org/learn" className="ds-link" target="_blank" rel="noopener noreferrer">
              Learning
            </Link>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="ds-btn ds-btn-primary"
          >
            Get Started
          </Link>
          <Link
            href="/signup"
            className="ds-btn ds-btn-secondary"
          >
            Sign Up
          </Link>
        </div>
      </main>
    </div>
  );
}
