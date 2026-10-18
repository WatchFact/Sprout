# November 2020 stylesheet adaptation

The owner supplied archived YouTube CSS. Most of it describes masthead/loading skeletons and Google picker internals rather than the complete application theme. Sprout uses scoped equivalents for the 56 px masthead, search box, square thumbnails, 36 px avatars, grey light/dark palette and shimmer skeleton, while retaining accessible real dialogs and working account controls.

The original global `a { display: none }` and `div { display: none }` extraction artifacts are not applied. Consent-suppression selectors and unused Google picker CSS are not included. No Google logo or YT Sans font is added. The four supplied Roboto v20 font files are self-hosted with their Apache 2.0 licence; visitors make no font requests to Google or Internet Archive. Reduced-motion preferences disable shimmer. Studio and Music retain their own layouts.
