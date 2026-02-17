const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, username } = await req.json();

    if (!platform || !username) {
      return new Response(
        JSON.stringify({ success: false, error: 'Platform and username are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanUsername = username.replace(/^@/, '').trim();
    
    // Use Firecrawl search to find stats about this social profile
    const searchQuery = `"${cleanUsername}" ${platform} followers seguidores site:socialblade.com OR site:socialcounts.org OR site:ninjalitics.com`;
    
    console.log(`Searching stats for @${cleanUsername} on ${platform}`);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${cleanUsername} ${platform} followers seguidores statistics`,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error('Firecrawl search error:', JSON.stringify(searchData));
      return new Response(
        JSON.stringify({ success: false, error: `Search failed: ${searchData.error || searchResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine all search result content
    const results = searchData.data || [];
    const allContent = results.map((r: any) => `${r.title || ''} ${r.description || ''} ${r.markdown || ''}`).join('\n');
    
    console.log(`Found ${results.length} search results, content length: ${allContent.length}`);

    const stats = parseStatsFromContent(allContent, platform, cleanUsername);

    return new Response(
      JSON.stringify({ success: true, data: stats, results_count: results.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseNumber(text: string): number {
  const clean = text.replace(/,/g, '').trim();
  const match = clean.match(/([\d.]+)\s*([KkMmBb])?/);
  if (!match) return 0;
  let num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K') num *= 1000;
  else if (suffix === 'M') num *= 1000000;
  else if (suffix === 'B') num *= 1000000000;
  return Math.round(num);
}

function parseStatsFromContent(content: string, platform: string, username: string) {
  const stats = { seguidores: 0, engajamento: 0, posts_semana: 0, crescimento: 0 };

  // Look for follower counts near the username
  const followerPatterns = [
    /(\d[\d,.]*[KkMmBb]?)\s*(?:followers|seguidores|subscriber|inscritos)/gi,
    /(?:followers|seguidores|subscriber|inscritos)[\s:]*(\d[\d,.]*[KkMmBb]?)/gi,
    /(\d[\d,.]*[KkMmBb]?)\s*(?:Followers|Seguidores)/g,
  ];

  const followerCounts: number[] = [];
  for (const pattern of followerPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const num = parseNumber(match[1]);
      if (num > 0) followerCounts.push(num);
    }
  }

  // Use the most common or median value
  if (followerCounts.length > 0) {
    followerCounts.sort((a, b) => a - b);
    stats.seguidores = followerCounts[Math.floor(followerCounts.length / 2)];
  }

  // Look for engagement rate
  const engPatterns = [
    /(?:engagement|engajamento)[\s:rate]*(\d+[.,]?\d*)%/gi,
    /(\d+[.,]?\d*)%\s*(?:engagement|engajamento)/gi,
  ];
  for (const pattern of engPatterns) {
    const match = pattern.exec(content);
    if (match) {
      stats.engajamento = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }

  // Estimate engagement if not found
  if (stats.engajamento === 0 && stats.seguidores > 0) {
    const avgEngagement: Record<string, number> = {
      'TikTok': 5.0, 'Instagram': 3.0, 'Facebook': 1.5, 'YouTube': 4.0, 'LinkedIn': 2.0,
    };
    stats.engajamento = avgEngagement[platform] || 2.0;
  }

  // Look for post counts
  const postPatterns = [
    /(\d[\d,.]*)\s*(?:posts|publicações|vídeos|videos|uploads)/gi,
  ];
  for (const pattern of postPatterns) {
    const match = pattern.exec(content);
    if (match) {
      stats.posts_semana = Math.min(parseNumber(match[1]), 14);
      break;
    }
  }

  // Growth
  const growthPatterns = [
    /(?:growth|crescimento)[\s:]*([+-]?\d+[.,]?\d*)%/gi,
  ];
  for (const pattern of growthPatterns) {
    const match = pattern.exec(content);
    if (match) {
      stats.crescimento = parseFloat(match[1].replace(',', '.'));
      break;
    }
  }

  return stats;
}
