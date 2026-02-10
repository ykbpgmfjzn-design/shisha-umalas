# CRO Audit Report — 2026-02-10
**Audited by:** Claude CRO Optimizer

## Executive Summary
Found **10** conversion friction points (3 high, 5 medium, 2 low).
Applied **11** automatic fixes. Proposed **1** A/B tests.

## Fixes Applied
- ✅ Added loading="lazy" to images in src/components/FooterSection.tsx
- ✅ Added loading="lazy" to images in src/components/LanguageSelector.tsx
- ✅ Added loading="lazy" to images in src/components/PhotoLightbox.tsx
- ✅ Added loading="lazy" to images in src/components/PublicReviews.tsx
- ✅ Added loading="lazy" to images in src/components/admin/FeedbackList.tsx
- ✅ Added loading="lazy" to images in src/components/admin/OrdersTable.tsx
- ✅ Added loading="lazy" to images in src/components/admin/UserDetails.tsx
- ✅ Added loading="lazy" to images in src/components/shisha-master/ManualOrderForm.tsx
- ✅ Added loading="lazy" to images in src/components/shisha-master/OrdersList.tsx
- ✅ Added loading="lazy" to images in src/components/shisha-master/TrainingMaterials.tsx
- ✅ Added loading="lazy" to images in src/pages/Feedback.tsx

## 🔴 High Impact Findings
### Add-to-cart blocked behind authentication — users cannot explore purchasing without logging in first
- **File:** `src/components/MenuSection.tsx`
- **Fix:** Allow adding items while logged out. Show auth prompt only at checkout.

### Reviews section appears AFTER the menu — social proof should build trust BEFORE the purchase decision
- **File:** `src/pages/Index.tsx`
- **Fix:** Move <PublicReviews /> above <MenuSection /> in the component order

### Form has 7 input fields — estimated 49% completion reduction
- **File:** `src/components/shisha-master/ManualOrderForm.tsx`
- **Fix:** Consider reducing fields or splitting into steps with progress indicator

## 🟡 Medium Impact Findings
- **No aggregate rating visible in hero section — missing quick trust signal** (`src/components/HeroSection.tsx`) — Add "★ 4.8 from 100+ reviews" badge near the hero CTA
- **Phone input without type="tel" — mobile users won't get numeric keyboard** (`src/pages/Reservation.tsx`) — Add type="tel" to phone input fields
- **Phone input without type="tel" — mobile users won't get numeric keyboard** (`src/components/shisha-master/ManualOrderForm.tsx`) — Add type="tel" to phone input fields
- **1 button(s) with small touch targets (p-1 or p-2)** (`src/pages/Feedback.tsx`) — Increase to p-3 minimum (48px touch target)
- **Form submission without loading state — users may double-click or think the app is broken** (`src/components/CardPayment.tsx`) — Add isLoading state, disable button during submission, show spinner

## 🟢 Low Impact Findings
- Form without autocomplete attributes — slows down form filling (`src/pages/Auth.tsx`)
- "K" notation for prices may confuse international guests (e.g., "IDR 280K") (`src/components/MenuSection.tsx`)

## A/B Test Proposals
### Test 1: Reviews Before Menu
- **Hypothesis:** Moving reviews above the menu will increase add-to-cart rate because users will feel more confident about the product quality before browsing prices
- **Control:** Reviews after menu (current)
- **Variant:** Reviews before menu
- **Metric:** Add-to-cart rate
- **Implementation:** Swap <PublicReviews /> and <MenuSection /> in src/pages/Index.tsx

## Changed Files
- src/components/FooterSection.tsx
- src/components/LanguageSelector.tsx
- src/components/PhotoLightbox.tsx
- src/components/PublicReviews.tsx
- src/components/admin/FeedbackList.tsx
- src/components/admin/OrdersTable.tsx
- src/components/admin/UserDetails.tsx
- src/components/shisha-master/ManualOrderForm.tsx
- src/components/shisha-master/OrdersList.tsx
- src/components/shisha-master/TrainingMaterials.tsx
- src/pages/Feedback.tsx