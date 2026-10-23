# Product photos — 2026-10-23

User-provided JPEGs mapped by the SKU printed on the packaging:

| Attachment | SKU |
| --- | --- |
| 1 | TIP-999 |
| 2 | TIP-777 |
| 3 | TIP-696 |
| 4 | TIP-580 |
| 5 | TIP-363 |

Original JPEGs preserved as the existing `icon-v2.jpg` assets. PNG files are format conversions at original 886 × 886 resolution, with no cropping or artwork generation. Updated canonical PNGs and legacy icon aliases in member public assets, plus website local copies. Five website detail pages now reference real product photographs instead of SVG illustrations.

Deployment overlays preserve existing application bundles and login settings:
- Member image `sha256:e4f828faed04d007579b2c5922ede0eaec8c42e14169c009f8e68d9d5007db72`; revision `ucell-prod-member--product-photos-20261023`.
- Website image `sha256:06988c5b27de55c0576c7a25a84fec873348d83f6db864b9c5a0d18d44757c71`; revision `ucell-prod-website--product-photos-20261023`.
- Both Healthy, 100% traffic. Admin uses the member image URLs already, so no admin application deployment or database edits were needed.

Verification after routing propagation: SHA-256 matches for all five canonical images on both member and website domains; all five website detail references correct; browser decoding confirms original dimensions; official catalog and detail screenshots reviewed. Admin production UI tested with a mocked read-only catalog and real published image assets: all five images loaded. No orders or member data changed. Existing member product responses use no-store/no-cache headers.

Screenshots: `C:/UCell/product-photos-20261023/`.
