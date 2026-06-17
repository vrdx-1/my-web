import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI and Bot Access Policy",
  description: "Public policy for AI systems and web crawlers interacting with Jutpai.",
  alternates: {
    canonical: "/ai-policy",
  },
};

export default function AiPolicyPage() {
  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "32px 20px 64px",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>AI and Bot Access Policy</h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Last updated: 2026-06-17
      </p>

      <h2>1) Scope</h2>
      <p>
        This policy explains how automated systems, including search engine crawlers, AI crawlers,
        and indexing bots, may access public content on Jutpai.
      </p>

      <h2>2) Allowed Access</h2>
      <p>
        Bots may access publicly available pages intended for discovery, including home, public post
        pages, and policy pages.
      </p>

      <h2>3) Restricted Access</h2>
      <p>
        Bots must not access authenticated areas, user account pages, administrative areas, private
        content, or internal API endpoints.
      </p>

      <h2>4) AI Usage Guidance</h2>
      <p>
        Public content may be used for indexing and summarization. Re-publication of substantial
        portions of content should include source attribution to Jutpai. Private or personal data
        must not be collected or processed beyond what is legally permitted.
      </p>

      <h2>5) Rate and Behavior</h2>
      <p>
        Crawlers should respect reasonable crawl rates, avoid abusive request patterns, and follow
        robots directives and applicable laws.
      </p>

      <h2>6) Contact</h2>
      <p>
        For bot verification, policy questions, or takedown concerns, contact the Jutpai support
        team through the official contact channels published on the platform.
      </p>
    </main>
  );
}
