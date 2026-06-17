import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
