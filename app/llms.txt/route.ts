import { NextResponse } from "next/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jutpai.com";

export async function GET() {
  const body = [
    "# Jutpai LLM Access Notes",
    "",
    `site: ${siteUrl}`,
    "owner: Jutpai",
    "",
    "## Preferred Public Pages",
    `${siteUrl}/`,
    `${siteUrl}/post/{id}`,
    `${siteUrl}/terms`,
    `${siteUrl}/ai-policy`,
    "",
    "## Restricted Areas",
    `${siteUrl}/admin`,
    `${siteUrl}/api`,
    `${siteUrl}/login`,
    `${siteUrl}/register`,
    `${siteUrl}/my-posts`,
    `${siteUrl}/saved`,
    `${siteUrl}/create-post`,
    `${siteUrl}/edit-post/{id}`,
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
