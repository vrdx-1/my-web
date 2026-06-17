import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/siteConfig";

export async function GET() {
  const body = [
    "# Jutpai LLM Access Notes",
    "",
    `site: ${SITE_URL}`,
    "owner: Jutpai",
    "",
    "## Preferred Public Pages",
    `${SITE_URL}/`,
    `${SITE_URL}/post/{id}`,
    `${SITE_URL}/terms`,
    `${SITE_URL}/ai-policy`,
    "",
    "## Restricted Areas",
    `${SITE_URL}/admin`,
    `${SITE_URL}/api`,
    `${SITE_URL}/login`,
    `${SITE_URL}/register`,
    `${SITE_URL}/my-posts`,
    `${SITE_URL}/saved`,
    `${SITE_URL}/create-post`,
    `${SITE_URL}/edit-post/{id}`,
    "",
    "## Policy",
    "Use public information for discovery and summarization.",
    "Do not collect personal data from restricted or private areas.",
    "Respect robots.txt directives and legal obligations.",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
