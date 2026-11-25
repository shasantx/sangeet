import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center bg-encore-base p-8 text-center">
      <p className="text-sm font-bold text-encore-accent">404</p>
      <h1 className="mt-2 text-3xl font-black text-encore-text">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-encore-subdued">
        We couldn&apos;t find the page you were looking for.
      </p>
      <Link
        href="/home"
        className="btn-cobalt mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-xs font-semibold transition active:scale-[0.98]"
      >
        Back to Home
      </Link>
    </div>
  );
}
