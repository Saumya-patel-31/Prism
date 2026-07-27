"use client";

import { isDemoMode, installDemoFetch } from "@/lib/demo/mockApi";

/* Installed at module scope from the ROOT layout so the patch lands before any
   page-level component mounts and fires its first fetch. Doing this from a
   nested layout is too late: page chunks can evaluate and run effects first. */
if (isDemoMode()) installDemoFetch();

export function DemoInit() {
  return null;
}
