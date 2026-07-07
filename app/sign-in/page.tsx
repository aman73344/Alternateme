"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignInLegacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/signin");
  }, [router]);

  return null;
}
