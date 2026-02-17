function parseNumber(text) {
  const clean = String(text || "").replace(/,/g, "").trim();
  const match = clean.match(/([\d.]+)\s*([KkMmBb])?/);
  if (!match) return 0;
  let num = Number.parseFloat(match[1]);
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") num *= 1_000;
  else if (suffix === "M") num *= 1_000_000;
  else if (suffix === "B") num *= 1_000_000_000;
  return Math.round(num);
}

function parseStatsFromContent(content, platform) {
  const stats = { seguidores: 0, engajamento: 0, posts_semana: 0, crescimento: 0 };

  const followerPatterns = [
    /(\d[\d,.]*[KkMmBb]?)\s*(?:followers|seguidores|subscriber|inscritos)/gi,
    /(?:followers|seguidores|subscriber|inscritos)[\s:]*(\d[\d,.]*[KkMmBb]?)/gi,
  ];
  const followerCounts = [];
  for (const pattern of followerPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const num = parseNumber(match[1]);
      if (num > 0) followerCounts.push(num);
    }
  }
  if (followerCounts.length > 0) {
    followerCounts.sort((a, b) => a - b);
    stats.seguidores = followerCounts[Math.floor(followerCounts.length / 2)];
  }

  const engPatterns = [
    /(?:engagement|engajamento)[\s:rate]*(\d+[.,]?\d*)%/gi,
    /(\d+[.,]?\d*)%\s*(?:engagement|engajamento)/gi,
  ];
  for (const pattern of engPatterns) {
    const match = pattern.exec(content);
    if (!match) continue;
    stats.engajamento = Number.parseFloat(match[1].replace(",", "."));
    break;
  }

  if (stats.engajamento === 0 && stats.seguidores > 0) {
    const avgEngagement = {
      TikTok: 5.0,
      Instagram: 3.0,
      Facebook: 1.5,
      YouTube: 4.0,
      LinkedIn: 2.0,
    };
    stats.engajamento = avgEngagement[platform] ?? 2.0;
  }

  const postPattern = /(\d[\d,.]*)\s*(?:posts|publicacoes|publicações|videos|vídeos|uploads)/gi;
  const postMatch = postPattern.exec(content);
  if (postMatch) stats.posts_semana = Math.min(parseNumber(postMatch[1]), 14);

  const growthPattern = /(?:growth|crescimento)[\s:]*([+-]?\d+[.,]?\d*)%/gi;
  const growthMatch = growthPattern.exec(content);
  if (growthMatch) stats.crescimento = Number.parseFloat(growthMatch[1].replace(",", "."));

  return stats;
}

export async function fetchSocialStats({ firecrawlApiKey, platform, username }) {
  if (!firecrawlApiKey) throw new Error("FIRECRAWL_API_KEY not configured");
  if (!platform || !username) throw new Error("Platform and username are required");

  const cleanUsername = String(username).replace(/^@/, "").trim();
  if (!cleanUsername) throw new Error("Username is required");

  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `${cleanUsername} ${platform} followers seguidores statistics`,
      limit: 5,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  const responseData = await response.json();
  if (!response.ok) {
    const message = responseData?.error || `Search failed with status ${response.status}`;
    throw new Error(message);
  }

  const results = Array.isArray(responseData?.data) ? responseData.data : [];
  const allContent = results
    .map((item) => `${item?.title || ""} ${item?.description || ""} ${item?.markdown || ""}`)
    .join("\n");

  return {
    data: parseStatsFromContent(allContent, platform),
    resultsCount: results.length,
  };
}

