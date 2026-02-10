#!/usr/bin/env node
/**
 * Daily SEO Optimizer for shisha.cool
 *
 * Pipeline: GA4 Analytics → SEO Audit → Auto-fix → Report
 * Runs via GitHub Actions daily (or manually)
 *
 * Required env vars:
 *   GA_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Configuration ──────────────────────────────────────────
const SITE_URL = 'https://www.shisha.cool';
const PUBLIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/reservation', priority: '0.8', changefreq: 'weekly' },
  { path: '/feedback', priority: '0.6', changefreq: 'monthly' },
  { path: '/auth', priority: '0.5', changefreq: 'monthly' },
  { path: '/order-history', priority: '0.4', changefreq: 'monthly' },
];

const TARGET_KEYWORDS = [
  'shisha Bali', 'hookah delivery Bali', 'shisha Umalas',
  'hookah Seminyak', 'shisha Canggu', 'premium hookah Bali',
  'shisha lounge Bali', 'hookah order Bali', 'shisha delivery',
  'best hookah Bali', 'rooftop shisha Bali',
];

const changes = [];
const report = { ga4: null, audit: [], fixes: [] };

// ─── GA4 API Functions ──────────────────────────────────────

function createJWT(clientEmail, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(privateKey, 'base64url');

  return `${unsignedToken}.${signature}`;
}

async function getAccessToken(clientEmail, privateKey) {
  const jwt = createJWT(clientEmail, privateKey);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GA4 auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function runGA4Report(accessToken, propertyId, startDate, endDate, dimensions, metrics) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map(name => ({ name })),
        metrics: metrics.map(name => ({ name })),
        limit: 50,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`GA4 report failed: ${JSON.stringify(data)}`);
  return data;
}

async function fetchGA4Data() {
  const propertyId = process.env.GA_PROPERTY_ID;
  const clientEmail = process.env.GA_CLIENT_EMAIL;
  let privateKey = process.env.GA_PRIVATE_KEY;

  if (!propertyId || !clientEmail || !privateKey) {
    console.warn('⚠️  GA4 credentials not set, skipping analytics fetch');
    return null;
  }

  // Handle escaped newlines from env vars
  privateKey = privateKey.replace(/\\n/g, '\n');

  console.log('📊 Fetching GA4 analytics data...');
  const accessToken = await getAccessToken(clientEmail, privateKey);

  // Parallel API calls
  const [dailyReport, topPagesReport, sourcesReport, bounceReport] = await Promise.all([
    runGA4Report(accessToken, propertyId, '7daysAgo', 'today', ['date'], ['sessions', 'screenPageViews']),
    runGA4Report(accessToken, propertyId, '30daysAgo', 'today', ['pagePath'], ['sessions', 'screenPageViews', 'bounceRate', 'averageSessionDuration']),
    runGA4Report(accessToken, propertyId, '30daysAgo', 'today', ['sessionSource'], ['sessions']),
    runGA4Report(accessToken, propertyId, '30daysAgo', 'today', ['pagePath'], ['bounceRate', 'sessions']),
  ]);

  const result = {
    fetchedAt: new Date().toISOString(),
    daily: (dailyReport.rows || []).map(r => ({
      date: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      pageViews: parseInt(r.metricValues[1].value),
    })),
    topPages: (topPagesReport.rows || []).map(r => ({
      path: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      pageViews: parseInt(r.metricValues[1].value),
      bounceRate: parseFloat(r.metricValues[2].value),
      avgDuration: parseFloat(r.metricValues[3].value),
    })).sort((a, b) => b.sessions - a.sessions),
    sources: (sourcesReport.rows || []).map(r => ({
      source: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
    })).sort((a, b) => b.sessions - a.sessions),
    highBouncePages: (bounceReport.rows || [])
      .map(r => ({
        path: r.dimensionValues[0].value,
        bounceRate: parseFloat(r.metricValues[0].value),
        sessions: parseInt(r.metricValues[1].value),
      }))
      .filter(p => p.bounceRate > 0.7 && p.sessions > 5)
      .sort((a, b) => b.bounceRate - a.bounceRate),
  };

  console.log(`   ✅ Got ${result.daily.length} daily records, ${result.topPages.length} top pages, ${result.sources.length} sources`);
  return result;
}

// ─── SEO Audit & Fix Functions ──────────────────────────────

function readFile(relativePath) {
  const full = path.join(ROOT, relativePath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null;
}

function writeFile(relativePath, content) {
  const full = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

// --- 1. Sitemap ---
function auditAndFixSitemap() {
  console.log('🗺️  Auditing sitemap.xml...');
  const today = new Date().toISOString().split('T')[0];

  const existingSitemap = readFile('public/sitemap.xml');
  const existingUrls = existingSitemap
    ? [...existingSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    : [];

  const missingRoutes = PUBLIC_ROUTES.filter(
    r => !existingUrls.includes(`${SITE_URL}${r.path}`)
  );

  // Always regenerate to update lastmod dates
  const urls = PUBLIC_ROUTES.map(r => `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n');

  const newSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  if (newSitemap.trim() !== (existingSitemap || '').trim()) {
    writeFile('public/sitemap.xml', newSitemap);
    const msg = missingRoutes.length > 0
      ? `Added ${missingRoutes.length} missing routes to sitemap, updated lastmod to ${today}`
      : `Updated sitemap lastmod dates to ${today}`;
    changes.push('public/sitemap.xml');
    report.fixes.push(msg);
    console.log(`   ✅ ${msg}`);
  } else {
    console.log('   ✓ Sitemap is up to date');
  }
}

// --- 2. Robots.txt ---
function auditAndFixRobots() {
  console.log('🤖 Auditing robots.txt...');
  let robots = readFile('public/robots.txt') || '';
  let changed = false;

  // Add sitemap reference if missing
  if (!robots.includes('Sitemap:')) {
    robots = robots.trimEnd() + `\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
    changed = true;
    report.fixes.push('Added Sitemap reference to robots.txt');
  }

  // Disallow internal/admin routes
  const disallowRoutes = ['/admin', '/accounting', '/shisha-master', '/activity-logs'];
  for (const route of disallowRoutes) {
    if (!robots.includes(`Disallow: ${route}`)) {
      // Add before the last line or at the end of the * block
      const lines = robots.split('\n');
      const lastAllowIdx = lines.findLastIndex(l => l.startsWith('Disallow:') || l.startsWith('Allow:'));
      if (lastAllowIdx >= 0) {
        lines.splice(lastAllowIdx + 1, 0, `Disallow: ${route}`);
      } else {
        lines.push(`Disallow: ${route}`);
      }
      robots = lines.join('\n');
      changed = true;
      report.fixes.push(`Added Disallow: ${route} to robots.txt`);
    }
  }

  if (changed) {
    writeFile('public/robots.txt', robots);
    changes.push('public/robots.txt');
    console.log('   ✅ Updated robots.txt');
  } else {
    console.log('   ✓ robots.txt is fine');
  }
}

// --- 3. Meta tags & Structured Data in index.html ---
function auditAndFixIndexHtml(ga4Data) {
  console.log('📄 Auditing index.html meta tags & structured data...');
  let html = readFile('index.html');
  if (!html) { console.warn('   ⚠️ index.html not found'); return; }
  let changed = false;

  // --- Preconnect hints ---
  const preconnects = [
    'https://www.googletagmanager.com',
    'https://hkgscohedqgxrhmbryww.supabase.co',
    'https://fonts.googleapis.com',
  ];
  for (const url of preconnects) {
    if (!html.includes(`href="${url}"`)) {
      html = html.replace(
        '<meta charset="UTF-8"',
        `<link rel="preconnect" href="${url}" crossorigin />\n    <meta charset="UTF-8"`
      );
      changed = true;
      report.fixes.push(`Added preconnect hint for ${url}`);
    }
  }

  // --- Ensure lang attribute is correct ---
  if (html.includes('lang="en"')) {
    // Site serves English content primarily, but for Bali audience - keep en
    // Add hreflang if not present
    if (!html.includes('hreflang')) {
      html = html.replace(
        '<link rel="canonical"',
        `<link rel="alternate" hreflang="en" href="${SITE_URL}/" />\n    <link rel="alternate" hreflang="id" href="${SITE_URL}/" />\n    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />\n    <link rel="canonical"`
      );
      changed = true;
      report.fixes.push('Added hreflang tags for en/id/x-default');
    }
  }

  // --- Structured Data Enhancement ---
  const ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ldJsonMatch) {
    try {
      const ld = JSON.parse(ldJsonMatch[1]);
      let ldChanged = false;

      // Add telephone
      if (!ld.telephone) {
        ld.telephone = '+62877-5078-3373';
        ldChanged = true;
        report.fixes.push('Added telephone to structured data');
      }

      // Add opening hours
      if (!ld.openingHoursSpecification) {
        ld.openingHoursSpecification = [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '14:00',
            closes: '02:00',
          }
        ];
        ldChanged = true;
        report.fixes.push('Added opening hours to structured data');
      }

      // Add social profiles / sameAs
      if (!ld.sameAs) {
        ld.sameAs = [
          'https://www.instagram.com/shisha.cool.lounge/',
          'https://wa.me/6287750783373',
        ];
        ldChanged = true;
        report.fixes.push('Added social profiles (sameAs) to structured data');
      }

      // Add areaServed
      if (!ld.areaServed) {
        ld.areaServed = [
          { '@type': 'City', name: 'Umalas' },
          { '@type': 'City', name: 'Seminyak' },
          { '@type': 'City', name: 'Canggu' },
          { '@type': 'City', name: 'Kerobokan' },
        ];
        ldChanged = true;
        report.fixes.push('Added areaServed to structured data');
      }

      // Add paymentAccepted
      if (!ld.paymentAccepted) {
        ld.paymentAccepted = 'Cash, Credit Card, QRIS, Bank Transfer';
        ldChanged = true;
        report.fixes.push('Added paymentAccepted to structured data');
      }

      // Add currenciesAccepted
      if (!ld.currenciesAccepted) {
        ld.currenciesAccepted = 'IDR';
        ldChanged = true;
        report.fixes.push('Added currenciesAccepted to structured data');
      }

      if (ldChanged) {
        const newLdJson = JSON.stringify(ld, null, 6);
        html = html.replace(ldJsonMatch[0], `<script type="application/ld+json">\n    ${newLdJson}\n    </script>`);
        changed = true;
      }
    } catch (e) {
      report.audit.push(`⚠️ Could not parse JSON-LD: ${e.message}`);
    }
  }

  // --- Dynamic meta optimization based on GA4 data ---
  if (ga4Data && ga4Data.sources) {
    const topSources = ga4Data.sources.slice(0, 3).map(s => s.source).join(', ');
    report.audit.push(`Top traffic sources: ${topSources}`);

    if (ga4Data.highBouncePages && ga4Data.highBouncePages.length > 0) {
      report.audit.push(`High bounce pages: ${ga4Data.highBouncePages.map(p => `${p.path} (${(p.bounceRate * 100).toFixed(0)}%)`).join(', ')}`);
    }

    // Calculate total weekly sessions
    const weeklyTotal = ga4Data.daily.reduce((sum, d) => sum + d.sessions, 0);
    report.audit.push(`Weekly sessions: ${weeklyTotal}`);
  }

  if (changed) {
    writeFile('index.html', html);
    changes.push('index.html');
    console.log('   ✅ Updated index.html');
  } else {
    console.log('   ✓ index.html is optimized');
  }
}

// --- 4. React Components SEO Audit ---
function auditReactComponents() {
  console.log('⚛️  Auditing React components for SEO...');

  // Check HeroSection for H1
  const heroContent = readFile('src/components/HeroSection.tsx');
  if (heroContent && !heroContent.includes('<h1')) {
    // Add a visually hidden H1 for SEO
    const newHero = heroContent.replace(
      '<p \n            className="font-display text-2xl',
      `<h1 className="sr-only">Shisha Cool Bali — Premium Hookah Delivery & Lounge in Umalas, Seminyak, Canggu</h1>\n          <p \n            className="font-display text-2xl`
    );
    if (newHero !== heroContent) {
      writeFile('src/components/HeroSection.tsx', newHero);
      changes.push('src/components/HeroSection.tsx');
      report.fixes.push('Added visually hidden H1 tag to HeroSection for SEO');
      console.log('   ✅ Added H1 to HeroSection');
    }
  } else {
    console.log('   ✓ HeroSection has H1');
  }

  // Check FooterSection for semantic improvements
  const footerContent = readFile('src/components/FooterSection.tsx');
  if (footerContent) {
    let newFooter = footerContent;
    let footerChanged = false;

    // Add aria-label to footer
    if (!newFooter.includes('aria-label')) {
      newFooter = newFooter.replace(
        '<footer className="relative py-24',
        '<footer aria-label="Contact and location information" className="relative py-24'
      );
      footerChanged = true;
      report.fixes.push('Added aria-label to footer');
    }

    if (footerChanged) {
      writeFile('src/components/FooterSection.tsx', newFooter);
      changes.push('src/components/FooterSection.tsx');
      console.log('   ✅ Updated FooterSection');
    }
  }

  // Check NotFound page for proper SEO
  const notFoundContent = readFile('src/pages/NotFound.tsx');
  if (notFoundContent && !notFoundContent.includes('useEffect')) {
    // Already has useEffect, check for meta
  }

  // Audit all image alt attributes across components
  const componentFiles = findFiles('src/components', '.tsx');
  const pageFiles = findFiles('src/pages', '.tsx');
  const allFiles = [...componentFiles, ...pageFiles];

  let missingAltCount = 0;
  for (const file of allFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Find img tags without alt or with empty alt=""
    const imgWithoutAlt = content.match(/<img\s+(?![^>]*\balt=)[^>]*>/g);
    if (imgWithoutAlt) {
      missingAltCount += imgWithoutAlt.length;
    }
  }

  if (missingAltCount > 0) {
    report.audit.push(`Found ${missingAltCount} images potentially missing alt attributes`);
  }

  // Check for heading hierarchy
  for (const file of allFiles) {
    const content = readFile(file);
    if (!content) continue;
    const h1s = (content.match(/<h1/g) || []).length;
    const h2s = (content.match(/<h2/g) || []).length;
    const h3s = (content.match(/<h3/g) || []).length;

    if (h1s > 1) {
      report.audit.push(`${file}: Multiple H1 tags found (${h1s})`);
    }
  }
}

function findFiles(dir, ext) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  const results = [];

  function walk(currentDir, prefix) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      const relative = path.join(prefix, entry.name);
      if (entry.isDirectory()) {
        walk(full, relative);
      } else if (entry.name.endsWith(ext)) {
        results.push(path.join(dir, relative));
      }
    }
  }

  walk(fullDir, '');
  return results;
}

// --- 5. Performance hints ---
function auditPerformanceHints() {
  console.log('⚡ Checking performance hints...');

  let html = readFile('index.html');
  if (!html) return;
  let changed = false;

  // Add dns-prefetch for external domains
  const dnsPrefetchDomains = [
    'https://www.google-analytics.com',
    'https://analyticsdata.googleapis.com',
  ];

  for (const domain of dnsPrefetchDomains) {
    if (!html.includes(`dns-prefetch" href="${domain}"`)) {
      html = html.replace(
        '<meta charset="UTF-8"',
        `<link rel="dns-prefetch" href="${domain}" />\n    <meta charset="UTF-8"`
      );
      changed = true;
      report.fixes.push(`Added dns-prefetch for ${domain}`);
    }
  }

  // Add theme-color meta tag for mobile browsers
  if (!html.includes('theme-color')) {
    html = html.replace(
      '<meta name="viewport"',
      '<meta name="theme-color" content="#1a1a2e" />\n    <meta name="viewport"'
    );
    changed = true;
    report.fixes.push('Added theme-color meta tag');
  }

  // Add mobile-web-app-capable
  if (!html.includes('mobile-web-app-capable')) {
    html = html.replace(
      '<meta name="viewport"',
      '<meta name="mobile-web-app-capable" content="yes" />\n    <meta name="viewport"'
    );
    changed = true;
    report.fixes.push('Added mobile-web-app-capable meta tag');
  }

  if (changed) {
    writeFile('index.html', html);
    if (!changes.includes('index.html')) changes.push('index.html');
    console.log('   ✅ Added performance hints');
  } else {
    console.log('   ✓ Performance hints already present');
  }
}

// ─── Report Generation ──────────────────────────────────────

function generateReport(ga4Data) {
  const today = new Date().toISOString().split('T')[0];
  const lines = [
    `# SEO Optimization Report — ${today}`,
    '',
  ];

  if (ga4Data) {
    const weeklyTotal = ga4Data.daily.reduce((sum, d) => sum + d.sessions, 0);
    lines.push('## GA4 Analytics Summary');
    lines.push(`- Weekly sessions: ${weeklyTotal}`);
    lines.push(`- Top page: ${ga4Data.topPages[0]?.path || 'N/A'} (${ga4Data.topPages[0]?.sessions || 0} sessions)`);
    lines.push(`- Top source: ${ga4Data.sources[0]?.source || 'N/A'} (${ga4Data.sources[0]?.sessions || 0} sessions)`);
    if (ga4Data.highBouncePages.length > 0) {
      lines.push(`- ⚠️ High bounce pages: ${ga4Data.highBouncePages.length}`);
    }
    lines.push('');
  }

  if (report.fixes.length > 0) {
    lines.push('## Fixes Applied');
    report.fixes.forEach(f => lines.push(`- ✅ ${f}`));
    lines.push('');
  }

  if (report.audit.length > 0) {
    lines.push('## Audit Notes');
    report.audit.forEach(a => lines.push(`- ${a}`));
    lines.push('');
  }

  lines.push(`## Changed Files`);
  if (changes.length > 0) {
    changes.forEach(c => lines.push(`- ${c}`));
  } else {
    lines.push('- No changes needed today');
  }

  return lines.join('\n');
}

// ─── Main Pipeline ──────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('   🌿 Daily SEO Optimizer — shisha.cool');
  console.log(`   📅 ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════\n');

  // Step 1: Fetch GA4 data
  let ga4Data = null;
  try {
    ga4Data = await fetchGA4Data();
    report.ga4 = ga4Data;
  } catch (err) {
    console.error(`❌ GA4 fetch error: ${err.message}`);
    report.audit.push(`GA4 fetch failed: ${err.message}`);
  }

  // Step 2: SEO audit & fixes
  auditAndFixSitemap();
  auditAndFixRobots();
  auditAndFixIndexHtml(ga4Data);
  auditReactComponents();
  auditPerformanceHints();

  // Step 3: Generate report
  const reportText = generateReport(ga4Data);
  console.log('\n' + reportText);

  // Save report
  writeFile('scripts/seo-reports/latest.md', reportText);
  const dateStr = new Date().toISOString().split('T')[0];
  writeFile(`scripts/seo-reports/${dateStr}.md`, reportText);

  // Step 4: Summary
  console.log('\n═══════════════════════════════════════════════');
  if (changes.length > 0) {
    console.log(`   ✅ ${changes.length} files changed`);
    console.log(`   📝 ${report.fixes.length} fixes applied`);
  } else {
    console.log('   ✓ No changes needed today');
  }
  console.log('═══════════════════════════════════════════════');

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = `has_changes=${changes.length > 0}\nchanged_files=${changes.join(',')}\nfixes_count=${report.fixes.length}`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
  }

  return changes.length > 0;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
