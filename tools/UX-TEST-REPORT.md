# Boothies in HK: user test report

Tested 8 Nov 2026 against a local copy of the site using the shared-list **test keys**, so the real class list was never touched. The scripted test (`.claude/ux_harness.js`) acts like a classmate: it taps, types and reloads, then checks the results.

## What good looks like for this kind of site

| Source | Guidance | How the site meets it |
|---|---|---|
| [NN/g: Maps & location finders on mobile](https://www.nngroup.com/articles/mobile-maps-locations/) | On phones the **list** matters more than the map. A map placed in the page can trap scrolling. Offer a way to hide the map. Hand directions off to a real maps app. | The list comes first. The map only moves after you tap it ("Tap map to zoom"). There's a **Hide map** button, and it's remembered. Each place opens in Google Maps or Citymapper. |
| [NN/g: Store finders](https://www.nngroup.com/articles/store-finders-and-locators/) | Accurate, easy-to-scan location details matter more than the visual format. | Each card has its area, a taxi time from Booth or the Park Lane, the Chinese name and address for taxi drivers, and opening hours. |
| [Baymard: Travel UX](https://baymard.com/research-articles/travel-site-ux-best-practices) & [filter UI](https://baymard.com/blog/ecommerce-filter-ui) | Offer a few meaningful filters, show how many results each choice gives, make it clear which filters are on, and keep them easy to clear. | One "I'm looking for… / where / that's…" sentence shows the count (→ 18 spots). Active map filters are highlighted, and **✕ Clear filters** appears whenever one is on. |
| Decision-fatigue research (choice overload) | Show a handful of strong options, not dozens. | Broad picks show the **top 3–5 per kind**. Any filter gives a **ranked top 10**, sorted by Google rating and review count. |
| [Splitwise UX critique](https://www.aubergine.co/insights/the-art-of-spending-helping-splitwise-split-right), [bill-split case studies](https://medium.com/design-bootcamp/designing-a-bill-splitting-app-de556d296e33) | Make settling up easy to find. Show the payee's preferred payment methods. Confirm payments from both sides. Keep the wording factual, not pushy. | "Pay Rienno" is the first thing in the class corner: amount, PayPal/card button, FPS and bank details with Copy, and cash. People tap "I've paid" and Rienno confirms. The wording is neutral ("Owes HK$400", "Waiting for Rienno"). |
| [WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Tap targets at least 24 px (AA), with 44 px recommended (Apple), and pages must reflow at 320 px wide. | Every tab is checked at 320 px and up. Tap targets are at least 24 px everywhere and 44 px on touch screens for the main controls. |

## Test cases (each run on every screen size)

1. **First visit, Eat & drink:** opens on "anywhere". Shows grouped top picks (3–5 each), a map pin for every listed place, and a result count.
2. **See top 10 and back:** "See top 10 →" gives one ranked list, and "← Back" returns to the grouped view (the phone's back gesture also works).
3. **Narrow down:** choosing Dinner groups the results by cuisine. A map filter gives a top-10 list and shows as active.
4. **Search:** "dim sum" finds places.
5. **Place card:** tapping opens the details and a Google Maps link. The taxi card opens with Chinese text and closes again.
6. **Shortlist:** the heart adds a place, the shortlist view lists it, and there's a share link.
7. **Memory:** the shortlist survives a reload.
8. **Explore:** the Sights/Hikes/Shopping switch works. Sights include Photo spots and Day trips. Photos load and are credited.
9. **First time:** the 6 Cantonese tones, the survival kit and fun facts are there, and "Tried it" updates the score.
10. **This week:** 9 day buttons, one day at a time. Tapping an idea opens its plan. The shuttle timetable is readable. "+ Me" while locked explains what to do.
11. **Class corner:** a wrong passcode gives a clear message. The right one unlocks the shared list. Picking your name shows what you owe and every payment option. "I'm going" toggles and saves.
12. **Organiser:** a wrong organiser code is refused.
13. **Memory:** the passcode and your name are remembered after a reload.

Each tab is also checked for: nothing running off the screen, tap targets of at least 24 px, body text of at least 11 px, and no JavaScript errors.

## Screen sizes

iPhone SE (320×568, 375×667), iPhone 15 (390×844), iPhone Pro Max (430×932), small Android (360×780), Pixel (412×915), iPad portrait (768×1024), iPad landscape (1024×768), phone landscape (844×390), laptop (1280×800) and desktop (1440×900).

## Results

RESULTS_PLACEHOLDER

## Found and fixed during testing

- **Map legend:** on tablets and desktop, the row of map filter buttons ran off the side once Sights had 10 categories. It now wraps onto a second line.
- **Small text:** review counts such as "(1.3k)" were 10.8 px and the "Where / Time / Dress" labels were 10 px. Both are now 11.5–12 px.
- **Week view:** on desktop each day was squeezed into a 238 px column, which caused cramped wrapping. Every screen now shows one day at a time.
- **Week view boxes:** the class list refreshes every 30 seconds, and that snapped open shuttle and ideas boxes shut. They now stay open.
- **Ticks moving:** saved ticks used to be tied to a row's position, so a schedule edit could move someone's tick onto the wrong event. They're now tied to the event itself.
- **Taxi times:** Kowloon estimates ignored the cross-harbour tunnel. They now add tunnel time and suggest the Star Ferry.
- **Tap targets:** several were under 44 px on phones (Change, Lock, Copy, name chips, ✕, "Map →"). All are enlarged.
- **Map vs list:** added Hide map (NN/g) and ✕ Clear filters (Baymard).

## Not covered by the automated test

- **Real devices:** the test emulates screen sizes in a browser. It doesn't test real touch gestures, iOS Safari quirks such as the bottom toolbar, or slow mobile data. Opening the site once on an iPhone and once on an Android phone is still worth doing.
- **Payment links:** the PayPal link opening PayPal with the amount filled in was tested with a sample link. It can only be checked for real once Rienno's PayPal.me link is added.
- **Screen readers:** VoiceOver and TalkBack weren't tested.
