# TODO (AI Devloop)

Edit this file to steer what the 2-hour AI timer should work on next.

## Current focus

1. **Improve company page Contacts section mobile layout** (`app/src/app/company/[id]/CompanyPageClient.tsx`)
   - Make phone/email rows easier to tap (larger touch targets)
   - Use consistent green accents for contact icons and “Написать” button (#166534)
   - Improve label hierarchy (smaller labels, increased letter-spacing)
   - Add a subtle divider between Contacts and About
   - Align icons to the top for multi-line content

## Constraints

- Dev only: `biznesinfo-develop.lucheestiy.com` / host port `8131`.
- Do not touch production (`biznesinfo.lucheestiy.com`).
- Keep changes small and reviewable.
