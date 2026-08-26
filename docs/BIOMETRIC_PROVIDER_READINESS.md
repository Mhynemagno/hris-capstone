# Biometric-provider readiness checklist

The current supported boundary is a secure CSV/XLSX import. Do not claim direct device compatibility until every item below is complete.

- [ ] Exact vendor, model, subscription/licence, and deployment topology recorded.
- [ ] Vendor API/webhook/export documentation and a test credential or live demo received.
- [ ] Stable external employee identifier and provider event identifier/idempotency semantics verified.
- [ ] Normalized event mapping tested: external ID, event ID, date, time-in, time-out, event type.
- [ ] Unknown IDs enter HR review; no name-based matching is permitted.
- [ ] Failure/retry/audit behavior tested with a non-production account.
- [ ] Written confirmation that no fingerprint template, face template, image, or raw biometric payload is transmitted to or stored by the HRIS.
- [ ] Any USB/kiosk SDK is separately designed and approved before purchase or implementation.
