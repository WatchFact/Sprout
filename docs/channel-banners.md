# Channel banners

Use the profile editor’s Channel banner section to choose, crop, zoom, reposition, preview, save, replace or remove a banner. Video Studio → Customization → Customise channel opens the same editor. Each personal or brand channel has its own banner; switching channels does not transfer images.

The editor accepts local JPG, PNG and WebP images up to 20 MB, with a 16-megapixel/12,000-pixel decode cap. It prepares a 2560 × 1440 JPEG in the browser. Full-image preview shows the central 1546 × 423 safe area; desktop and mobile previews show the same crops as the public channel header. Centre names/logos inside the guide. Source object URLs are released after save/cancel/replacement/unmount.

The server accepts only authenticated, unlocked, publishing-capable channel owners; same-origin checks and moderator profile restrictions apply. Image MIME/magic and declared/actual byte lengths are checked with a 6 MB streaming input limit. SVG and external image URLs are not accepted. Current banner pointers and storage tracking records are persisted, previous objects are deleted after replacement, and account erasure includes tracked banner files. Published profiles expose banner URLs through public identities. Private/removed profiles do not expose banners to other viewers; media requests check the current profile status.

Tests cover auth, cross-origin rejection, file validation/limits, parent/brand isolation, public versus removed-profile media access, replacement/removal, account erasure, viewing-only restrictions and editor SSR. TypeScript and both production builds are required before publication. Browser visual/touch QA is unavailable in this environment.
