# Source and verification policy

Research checked: 14 September 2026.

## Source hierarchy

### Tier 1 - controlling or primary authority

Use these to confirm and publish data:

1. Federal or state gazettes and notifications issued under the applicable law.
2. BKPP, Jabatan Perdana Menteri annual federal/state holiday schedule and its amendments.
3. An official federal or state government announcement by the office legally declaring the holiday.

Relevant legal regimes are not identical throughout Malaysia:

- Holidays Act 1951 (Act 369), including its application to Peninsular Malaysia and extension/modification for Labuan;
- Holidays Ordinance (Sabah Cap. 56);
- Public Holidays Ordinance (Sarawak Cap. 8).

The API must retain the jurisdiction and legal/source document behind each declaration. A federal schedule alone must not be treated as the complete legal rule engine for Sabah and Sarawak.

### Tier 2 - official operational confirmation

Use as corroboration and for employment/implementation guidance:

- Department of Labour / Ministry of Human Resources notices;
- official state secretariat portals;
- official government press releases and verified government social channels.

Tier 2 can trigger review, but should not replace a more specific Tier 1 instrument when one exists.

### Tier 3 - detection only

Reputable news organisations and commercial calendar providers may alert us to a new declaration. They do not independently justify `confirmed` status.

## Publication states

- `confirmed`: supported by at least one Tier 1 source.
- `announced`: an official announcement exists, but the controlling instrument or exact scope is not yet available.
- `provisional`: the official schedule explicitly marks the date as subject to change.
- `cancelled`: superseded or withdrawn, with the superseding source retained.

## Special-holiday workflow

1. Poll registered official index pages and feeds.
2. Store a content hash and immutable retrieval timestamp.
3. When content changes, extract candidate date, jurisdiction, title, declaring authority and source URL.
4. Reject publication if geographic scope or legal effect is ambiguous.
5. Ask for human approval for every new one-off declaration during the MVP.
6. Publish a new revision; never overwrite the historical record.

## Observed and employment holidays

The declared holiday date, a statutory substitute/observed date, and an employer-selected paid holiday are different concepts. They must be represented separately. The API will not infer a universal replacement date without knowing the applicable jurisdiction and weekly rest-day rule.

## Primary references

- BKPP annual schedules: https://www.kabinet.gov.my/hari-kelepasan-am/
- BKPP acts and gazettes: https://www.kabinet.gov.my/akta-dan-warta/
- 2026 official schedule: https://www.kabinet.gov.my/storage/2025/08/HKA-2026.pdf
- 2027 official schedule: https://www.kabinet.gov.my/storage/2026/08/HKA_2027.pdf
- Holidays Act 1951 (Act 369): https://www.kabinet.gov.my/storage/2024/11/1951_12_31_act369.pdf
- Labour Department calendar: https://jtksm.mohr.gov.my/en/kalendar

BKPP states that the following year's schedule is normally published from August. The annual page is therefore a baseline, while the acts-and-gazettes page is the key monitor for amendments and impromptu holidays.
