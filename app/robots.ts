import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jutpai.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/terms", "/ai-policy", "/post/"],
        disallow: [
          "/admin",
          "/api",
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/reset-password-otp",
          "/my-posts",
          "/saved",
          "/create-post",
          "/edit-post",
          "/boost_post",
          "/notification",
          "/profile",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
