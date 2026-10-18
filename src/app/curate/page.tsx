import type { Metadata } from "next";
import CurateTool from "@/components/CurateTool";

export const metadata: Metadata = { title: "Curate letters · Track Forge" };

export default function CuratePage() {
  return <CurateTool />;
}
