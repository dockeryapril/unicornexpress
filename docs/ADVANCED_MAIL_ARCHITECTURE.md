# Advanced Digital Mail Architecture

## Current application

- TanStack Start + React 19 + TypeScript, bundled by Vite and styled with Tailwind CSS 4.
- Supabase provides the only persistent table (`postcards`) and a private `postcards` storage bucket.
- The composer already supports camera/library photos, four visual templates, typed handwriting-style copy, freehand ink, movable emoji stickers, and a 30-second voice recording.
- Publishing uploads assets, inserts one postcard row, and returns a public-looking slug. The shared page fetches the complete row and year-long signed asset URLs.
- Supabase auth plumbing exists, but there is no sign-in UI, no user ownership on postcard rows, and no recipient account/address resolution.

## Important security gap

The current `/p/:slug` flow cannot enforce the product's possession rule. Anyone with a slug can request all content immediately, and a sender can retain that URL. Hiding the card in React would not be security.

The mail lifecycle must therefore ship with authenticated identities, private asset authorization, and row-level policies as one backend migration. Until then, the existing share-link behavior should remain intact rather than presenting a false lockout.

## Reusable existing work

| Existing capability              | Reuse plan                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PostcardFront` / `PostcardBack` | Keep as the canonical visual composition surfaces inside the 3D viewer.                                                 |
| `DrawLayer`                      | Keep the canvas implementation; add history and erasing, then store its flattened PNG in the immutable mailed snapshot. |
| Sticker placement JSON           | Evolve placements to reference catalog sticker IDs while keeping transform data on the snapshot.                        |
| `VoiceRecorder`                  | Keep recording UX; move retrieval behind delivery-aware authorization.                                                  |
| Supabase storage                 | Split draft uploads from immutable mailed assets and issue short-lived URLs only after an authorization check.          |
| TanStack routes                  | Add mailbox, tracking, and authenticated postcard-view routes without replacing the composer.                           |

## Proposed data model

The first database migration should be additive and preserve current prototype rows.

### Identity and postcards

- `profiles`: user display name and notification preferences; ID references `auth.users`.
- `postcards`: sender/receiver IDs, recipient address token or invite, lifecycle status, postage class, tracking number, origin/destination labels, mail/delivery/open timestamps, and an immutable `composition_snapshot` JSON value.
- `postcard_assets`: private storage paths and asset kind (`PHOTO`, `DRAWING`, `AUDIO`, future render output).
- `tracking_events`: append-only status events with timestamp, display location, detail, and optional delay code.
- `mail_routes`: simulation version, route stops, total duration, and calculation inputs so a mailed journey is deterministic.

### Catalog and inventory

- `catalog_collections`: sticker/stamp pack metadata, creator, visibility, edition size, and availability window.
- `catalog_items`: typed catalog records (`STAMP`, `STICKER`) with artwork, rarity, price/credit metadata, and optional future location rule.
- `user_inventory`: owner, item, quantity, acquired/used timestamps, and source. A consumed stamp is an inventory transaction, not a deleted record.
- `inventory_ledger`: append-only credit and collectible changes for reliable future commerce integration.

### Notifications

- `notifications`: recipient, event kind, postcard ID, read time, and deep-link data. Delivery creation should be server-controlled.

## Immutable composition snapshot

Mailing writes a permanent versioned snapshot containing template, message layout, address layout, drawing asset, placed sticker catalog IDs/transforms, selected stamp catalog ID/transform, and audio asset reference. Draft tables may remain editable, but the mailed snapshot never changes.

## Backend access rules

| Actor and state            | Tracking metadata | Postcard contents |
| -------------------------- | ----------------- | ----------------- |
| Sender, draft/ready        | Yes               | Read/write        |
| Sender, mailed or later    | Yes               | Denied            |
| Receiver, before delivery  | Yes               | Denied            |
| Receiver, delivered/opened | Yes               | Read-only         |
| Everyone else              | Denied            | Denied            |

These rules belong in Supabase row-level policies and server functions. Storage paths must follow equivalent policies; year-long signed URLs cannot be issued after mailing.

## Implementation order

1. **Physical card foundation:** 3D pointer/touch viewer, fixed front/back geometry, drawing undo/redo/eraser, and complete sticker transforms.
2. **Secure mail boundary:** add authentication and recipient resolution, run the additive schema migration, snapshot/consume-stamp transaction, RLS, private asset authorization, and sender lockout.
3. **Catalog foundation:** normalized stamp/sticker catalogs, starter inventory, stamp-required validation, and pack-ready selectors.
4. **Journey:** tracking number, deterministic business-day simulation, append-only events, timeline, and simulated-route disclosure.
5. **Receiving:** incoming-mail shell, delivery/open ceremony, receiver ownership, mailbox collection, audio playback after delivery, and notification hooks.

## Technical risks and decisions needed

- **Recipient identity:** phone/email invite versus existing-user selection changes both privacy and onboarding. It must be decided before the secure-mail migration.
- **Legacy links:** current shared postcards need an explicit grandfathering policy; they cannot retroactively identify sender and receiver.
- **Scheduler:** status progression needs a trusted scheduled function or lazy server reconciliation, not a client timer.
- **Maps/geocoding:** store coarse city/region coordinates only. Exact home addresses should never be exposed on the tracking map.
- **Push delivery:** web push requires service-worker, permission, and device-token infrastructure. The UI should not promise delivery sounds until those are configured.
- **Media permanence:** audio/photo retention and deletion policy should be defined before collectible mail becomes permanent.

## Dependencies

The first physical-interaction phase needs no new runtime package. Later phases may use a map renderer, Supabase scheduled/edge functions, and a web-push service, but those should only be added when their phase begins.
