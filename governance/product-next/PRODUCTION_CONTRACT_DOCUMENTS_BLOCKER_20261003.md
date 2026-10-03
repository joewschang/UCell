# Production blocker: approved member contract and privacy documents

Product Owner approved an empty Stage testing document on 2026-10-03. It is explicitly titled as a Stage placeholder and expires 2026-10-10 UTC. Its content is empty; neither the document nor test consent evidence is an approved legal contract.

Before any Production deployment, remind the Product Owner and obtain the company-approved network-member contract and privacy notice, with approved version, content hash and effective dates. Publish approved documents through normal governance. Confirm registration displays the actual text and records explicit consent to that exact version. Do not copy the Stage empty document or its consent evidence to Production, and do not treat test consent as formal consent.

Production release remains blocked until this evidence is supplied and verified. Stage script: deployment/seed-stage-empty-network-contract.cjs; allowlisted Stage database only. Existing formal-member contracts are unaffected.
