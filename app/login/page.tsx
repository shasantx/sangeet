"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthPage from "@/app/auth/page";

function LoginRedirect() {
  return <AuthPage />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#090b09]" />}>
      <LoginRedirect />
    </Suspense>
  );
}
