#!/usr/bin/env node
/**
 * CRO Audit Script for shisha.cool
 *
 * Analyzes the codebase for conversion friction and applies auto-fixes.
 * Designed to work alongside the daily-seo.mjs pipeline.
 *
 * Run: node scripts/cro-audit.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const report = { findings: [], fixes: [], abTests: [] };
const changes = [];

// ─── Utilities ──────────────────────────────────────────────

function readFile(rel) {
  const full = path.join(ROOT, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null;
}

function writeFile(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

function findFiles(dir, ext) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  const results = [];
  function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      const rel = path.join(prefix, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'ui') {
        walk(full, rel);
      } else if (e.name.endsWith(ext)) {
        results.push(path.join(dir, rel));
      }
    }
  }
  walk(fullDir, '');
  return results;
}

// ─── Audit: Touch Targets ───────────────────────────────────

function auditTouchTargets() {
  console.log('👆 Auditing touch targets...');
  const files = [...findFiles('src/components', '.tsx'), ...findFiles('src/pages', '.tsx')];

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    // Check for small padding on buttons (p-1, p-2 = too small for touch)
    const smallButtons = content.match(/<(button|Button|motion\.button)[^>]*className="[^"]*\bp-[12]\b[^"]*"[^>]*>/g);
    if (smallButtons) {
      report.findings.push({
        severity: 'medium',
        file,
        issue: `${smallButtons.length} button(s) with small touch targets (p-1 or p-2)`,
        recommendation: 'Increase to p-3 minimum (48px touch target)',
      });
    }
  }
}

// ─── Audit: Image Lazy Loading ──────────────────────────────

function auditLazyLoading() {
  console.log('🖼️  Auditing image lazy loading...');
  const files = [...findFiles('src/components', '.tsx'), ...findFiles('src/pages', '.tsx')];
  let fixCount = 0;

  for (const file of files) {
    let content = readFile(file);
    if (!content) continue;
    let changed = false;

    // Find <img tags without loading="lazy" (excluding hero/above-fold images)
    const isHero = file.includes('Hero') || file.includes('Splash');
    if (!isHero) {
      // Add loading="lazy" to img tags that don't have it
      const imgRegex = /<img\s+(?![^>]*loading=)[^>]*src=/g;
      if (imgRegex.test(content)) {
        content = content.replace(/<img(\s+)(?![^>]*loading=)([^>]*src=)/g, '<img$1loading="lazy" $2');
        changed = true;
        fixCount++;
      }
    }

    if (changed) {
      writeFile(file, content);
      changes.push(file);
      report.fixes.push(`Added loading="lazy" to images in ${file}`);
    }
  }

  if (fixCount > 0) {
    console.log(`   ✅ Added lazy loading to ${fixCount} file(s)`);
  } else {
    console.log('   ✓ All images have lazy loading');
  }
}

// ─── Audit: Form UX ────────────────────────────────────────

function auditFormUX() {
  console.log('📝 Auditing form UX...');
  const files = [...findFiles('src/pages', '.tsx'), ...findFiles('src/components', '.tsx')];

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    // Check for type="tel" on phone inputs
    if (content.includes('phone') || content.includes('Phone')) {
      if (!content.includes('type="tel"') && content.includes('<Input') || content.includes('<input')) {
        report.findings.push({
          severity: 'medium',
          file,
          issue: 'Phone input without type="tel" — mobile users won\'t get numeric keyboard',
          recommendation: 'Add type="tel" to phone input fields',
        });
      }
    }

    // Check for autocomplete attributes on forms
    if (content.includes('<form') || content.includes('<Form')) {
      if (!content.includes('autoComplete') && !content.includes('autocomplete')) {
        report.findings.push({
          severity: 'low',
          file,
          issue: 'Form without autocomplete attributes — slows down form filling',
          recommendation: 'Add autoComplete="on" to forms and specific fields (name, email, tel)',
        });
      }
    }

    // Count form fields (each field reduces completion by ~7%)
    const inputCount = (content.match(/<(Input|input|Textarea|textarea|Select|select)\s/g) || []).length;
    if (inputCount > 6) {
      report.findings.push({
        severity: 'high',
        file,
        issue: `Form has ${inputCount} input fields — estimated ${(inputCount * 7)}% completion reduction`,
        recommendation: 'Consider reducing fields or splitting into steps with progress indicator',
      });
    }
  }
}

// ─── Audit: CTA Quality ────────────────────────────────────

function auditCTAs() {
  console.log('🎯 Auditing CTAs...');
  const files = [...findFiles('src/components', '.tsx'), ...findFiles('src/pages', '.tsx')];

  const weakCTACopy = ['submit', 'send', 'continue', 'next', 'ok', 'go'];

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    // Find button text content
    const buttonTexts = content.match(/<(Button|button)[^>]*>([^<]+)<\/(Button|button)>/gi);
    if (buttonTexts) {
      for (const btn of buttonTexts) {
        const textMatch = btn.match(/>([^<]+)</);
        if (textMatch) {
          const text = textMatch[1].trim().toLowerCase();
          if (weakCTACopy.some(w => text === w)) {
            report.findings.push({
              severity: 'medium',
              file,
              issue: `Weak CTA copy: "${textMatch[1].trim()}" — generic text reduces click-through`,
              recommendation: 'Use action+benefit copy: "Order Now", "Book My Session", "Complete Payment"',
            });
          }
        }
      }
    }
  }
}

// ─── Audit: Social Proof Placement ──────────────────────────

function auditSocialProof() {
  console.log('⭐ Auditing social proof placement...');

  const indexContent = readFile('src/pages/Index.tsx');
  if (!indexContent) return;

  // Check if reviews come after menu (bad) or before (good)
  const menuPos = indexContent.indexOf('MenuSection');
  const reviewPos = indexContent.indexOf('PublicReviews');

  if (menuPos >= 0 && reviewPos >= 0 && reviewPos > menuPos) {
    report.findings.push({
      severity: 'high',
      file: 'src/pages/Index.tsx',
      issue: 'Reviews section appears AFTER the menu — social proof should build trust BEFORE the purchase decision',
      recommendation: 'Move <PublicReviews /> above <MenuSection /> in the component order',
    });

    report.abTests.push({
      name: 'Reviews Before Menu',
      hypothesis: 'Moving reviews above the menu will increase add-to-cart rate because users will feel more confident about the product quality before browsing prices',
      control: 'Reviews after menu (current)',
      variant: 'Reviews before menu',
      metric: 'Add-to-cart rate',
      implementation: 'Swap <PublicReviews /> and <MenuSection /> in src/pages/Index.tsx',
    });
  }

  // Check for aggregate rating display
  const heroContent = readFile('src/components/HeroSection.tsx');
  if (heroContent && !heroContent.includes('rating') && !heroContent.includes('review') && !heroContent.includes('★')) {
    report.findings.push({
      severity: 'medium',
      file: 'src/components/HeroSection.tsx',
      issue: 'No aggregate rating visible in hero section — missing quick trust signal',
      recommendation: 'Add "★ 4.8 from 100+ reviews" badge near the hero CTA',
    });
  }
}

// ─── Audit: Auth Wall ───────────────────────────────────────

function auditAuthWall() {
  console.log('🔒 Auditing auth wall friction...');
  const files = [...findFiles('src/components', '.tsx'), ...findFiles('src/pages', '.tsx')];

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    // Check for patterns that block actions behind auth
    if (content.includes('!user') && (content.includes('toast') || content.includes('return'))) {
      if (content.includes('addItem') || content.includes('addToCart') || content.includes('handleAddToCart')) {
        report.findings.push({
          severity: 'high',
          file,
          issue: 'Add-to-cart blocked behind authentication — users cannot explore purchasing without logging in first',
          recommendation: 'Allow adding items while logged out. Show auth prompt only at checkout.',
        });
      }
    }
  }
}

// ─── Audit: Mobile Navigation ───────────────────────────────

function auditMobileNav() {
  console.log('📱 Auditing mobile navigation...');

  const navContent = readFile('src/components/BottomNavigation.tsx');
  if (!navContent) return;

  // Count navigation items
  const navItems = (navContent.match(/NavLink|to="/g) || []).length;
  if (navItems > 4) {
    report.findings.push({
      severity: 'medium',
      file: 'src/components/BottomNavigation.tsx',
      issue: `Bottom navigation has ${navItems} items — takes up excessive mobile viewport space`,
      recommendation: 'Reduce to 3-4 core items. Move secondary links into a profile menu.',
    });
  }
}

// ─── Audit: Loading States ──────────────────────────────────

function auditLoadingStates() {
  console.log('⏳ Auditing loading states...');
  const files = [...findFiles('src/components', '.tsx'), ...findFiles('src/pages', '.tsx')];

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    // Check for form submit handlers without loading state
    if (content.includes('onSubmit') || content.includes('handleSubmit')) {
      if (!content.includes('isLoading') && !content.includes('isPending') && !content.includes('isSubmitting') && !content.includes('loading')) {
        report.findings.push({
          severity: 'medium',
          file,
          issue: 'Form submission without loading state — users may double-click or think the app is broken',
          recommendation: 'Add isLoading state, disable button during submission, show spinner',
        });
      }
    }
  }
}

// ─── Audit: Price Clarity ───────────────────────────────────

function auditPriceClarity() {
  console.log('💰 Auditing price display...');
  const files = [...findFiles('src/components', '.tsx'), ...findFiles('src/pages', '.tsx')];

  for (const file of files) {
    const content = readFile(file);
    if (!content) continue;

    // Check for 'K' notation without explanation
    if (content.includes('IDR') && content.includes('K"') && !content.includes('thousand') && !content.includes('.000')) {
      report.findings.push({
        severity: 'low',
        file,
        issue: '"K" notation for prices may confuse international guests (e.g., "IDR 280K")',
        recommendation: 'Consider showing full price on hover/tooltip or using "IDR 280,000" for first occurrence',
      });
    }
  }
}

// ─── Report Generation ──────────────────────────────────────

function generateReport() {
  const today = new Date().toISOString().split('T')[0];

  const high = report.findings.filter(f => f.severity === 'high');
  const medium = report.findings.filter(f => f.severity === 'medium');
  const low = report.findings.filter(f => f.severity === 'low');

  const lines = [
    `# CRO Audit Report — ${today}`,
    `**Audited by:** Claude CRO Optimizer`,
    '',
    '## Executive Summary',
    `Found **${report.findings.length}** conversion friction points (${high.length} high, ${medium.length} medium, ${low.length} low).`,
    `Applied **${report.fixes.length}** automatic fixes. Proposed **${report.abTests.length}** A/B tests.`,
    '',
  ];

  if (report.fixes.length > 0) {
    lines.push('## Fixes Applied');
    report.fixes.forEach(f => lines.push(`- ✅ ${f}`));
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('## 🔴 High Impact Findings');
    high.forEach(f => {
      lines.push(`### ${f.issue}`);
      lines.push(`- **File:** \`${f.file}\``);
      lines.push(`- **Fix:** ${f.recommendation}`);
      lines.push('');
    });
  }

  if (medium.length > 0) {
    lines.push('## 🟡 Medium Impact Findings');
    medium.forEach(f => {
      lines.push(`- **${f.issue}** (\`${f.file}\`) — ${f.recommendation}`);
    });
    lines.push('');
  }

  if (low.length > 0) {
    lines.push('## 🟢 Low Impact Findings');
    low.forEach(f => {
      lines.push(`- ${f.issue} (\`${f.file}\`)`);
    });
    lines.push('');
  }

  if (report.abTests.length > 0) {
    lines.push('## A/B Test Proposals');
    report.abTests.forEach((t, i) => {
      lines.push(`### Test ${i + 1}: ${t.name}`);
      lines.push(`- **Hypothesis:** ${t.hypothesis}`);
      lines.push(`- **Control:** ${t.control}`);
      lines.push(`- **Variant:** ${t.variant}`);
      lines.push(`- **Metric:** ${t.metric}`);
      lines.push(`- **Implementation:** ${t.implementation}`);
      lines.push('');
    });
  }

  lines.push('## Changed Files');
  if (changes.length > 0) {
    changes.forEach(c => lines.push(`- ${c}`));
  } else {
    lines.push('- No auto-fixes applied');
  }

  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────

// ─── Auto-Fix: type="tel" for phone inputs ────────────────
function fixPhoneInputTypes() {
  const files = findFiles(path.join(ROOT, 'src'), '.tsx');
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    let content = readFile(rel);
    if (!content) continue;
    // Find <Input ... placeholder="+62" or phone-related without type="tel"
    const phonePattern = /(<Input\s[^>]*(?:placeholder="[^"]*(?:\+62|phone)[^"]*"|onChange=\{[^}]*Phone[^}]*\})[^>]*)(?<!\btype="tel")(\s*\/>)/gi;
    let changed = false;
    content = content.replace(phonePattern, (match, before, after) => {
      if (match.includes('type="tel"')) return match;
      changed = true;
      return before + ' type="tel" autoComplete="tel"' + after;
    });
    if (changed) {
      writeFile(rel, content);
      report.fixes.push(`Added type="tel" to phone inputs in ${rel}`);
      changes.push(rel);
    }
  }
}

// ─── Auto-Fix: autocomplete attributes for auth forms ──────
function fixAutoComplete() {
  const authFile = 'src/pages/Auth.tsx';
  let content = readFile(authFile);
  if (!content) return;
  let changed = false;
  // Add autoComplete="email" to email inputs
  if (content.includes('type="email"') && !content.includes('autoComplete="email"')) {
    content = content.replace(
      /(<Input\s[^>]*type="email")/g,
      '$1\n                autoComplete="email"'
    );
    changed = true;
  }
  // Add autoComplete to password inputs
  if (content.includes('type="password"') && !content.includes('autoComplete=')) {
    content = content.replace(
      /(<Input\s[^>]*type="password")/g,
      '$1\n                autoComplete="current-password"'
    );
    changed = true;
  }
  if (changed) {
    writeFile(authFile, content);
    report.fixes.push('Added autocomplete attributes to auth form inputs');
    changes.push(authFile);
  }
}

// ─── Auto-Fix: ensure minimum touch target padding ─────────
function fixTouchTargets() {
  const files = findFiles(path.join(ROOT, 'src'), '.tsx');
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    let content = readFile(rel);
    if (!content) continue;
    let changed = false;
    // Replace p-1 with p-3 on interactive elements (buttons)
    const pattern = /(<(?:motion\.)?button\s[^>]*className="[^"]*)\bp-1\b/g;
    content = content.replace(pattern, (match, before) => {
      changed = true;
      return before + 'p-3';
    });
    if (changed) {
      writeFile(rel, content);
      report.fixes.push(`Increased touch target padding in ${rel}`);
      changes.push(rel);
    }
  }
}

function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('   🎯 CRO Audit — shisha.cool');
  console.log(`   📅 ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════\n');

  auditAuthWall();
  auditSocialProof();
  auditCTAs();
  auditFormUX();
  auditTouchTargets();
  auditMobileNav();
  auditLazyLoading();
  auditLoadingStates();
  auditPriceClarity();

  // Auto-fix passes
  fixPhoneInputTypes();
  fixAutoComplete();
  fixTouchTargets();

  const reportText = generateReport();
  console.log('\n' + reportText);

  const today = new Date().toISOString().split('T')[0];
  writeFile('scripts/cro-reports/latest.md', reportText);
  writeFile(`scripts/cro-reports/${today}.md`, reportText);

  console.log('\n═══════════════════════════════════════════════');
  console.log(`   📊 ${report.findings.length} findings, ${report.fixes.length} fixes, ${report.abTests.length} A/B tests`);
  console.log('═══════════════════════════════════════════════');
}

main();
