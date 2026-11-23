import { NextResponse } from "next/server";
import {
  isGoogleConfigured,
  isMicrosoftConfigured,
} from "@/lib/auth-options";

export function GET() {
  return NextResponse.json({
    google: isGoogleConfigured(),
    microsoft: isMicrosoftConfigured(),
  });
}
