# V1.2 Referral Share Entry — 2026-09-17

Status: MEMBER SHARE ENTRY IMPLEMENTED; 30-day landing attribution remains the next database slice.

An authenticated member can request a server-generated HTTPS referral URL for the currently selected owned Qualification. The Backend rechecks temporal ownership, encrypts the Qualification identity in an expiring authenticated token and fails closed when URL/secret/TTL configuration is absent or invalid. Foreign Qualification requests are denied. The client never sends Sponsor identity and cannot construct or alter the referral token.

The Member Sponsor view now creates the URL on explicit user action and uses the device share API or clipboard fallback. It validates that the response belongs to the selected ball and does not treat sharing as Sponsor creation, placement or monetary recognition.

Fresh DB Golden verifies exact owned-ball token binding, configured landing origin, server token verification and foreign-ball denial. Member tests verify request shape, response-ball mismatch rejection and absence of client Sponsor mutation. Anonymous landing, 30-day attribution lock/replacement, Person binding and LIFF transition state are intentionally not claimed by this checkpoint.
