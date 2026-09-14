# Contributing

Thank you for helping improve Malaysian public-holiday data.

## Holiday corrections

A correction must include:

- the affected date and jurisdiction;
- the proposed change;
- a direct link to a primary government source;
- whether the source is an annual schedule, gazette, amendment or special declaration.

News reports and commercial calendars can be submitted as leads, but they cannot independently support `confirmed` status.

Do not infer replacement days without identifying the applicable jurisdiction and weekly rest-day rule. Do not silently replace an old record: declarations and corrections require revision history.

## Development

```bash
npm install
npm run typecheck
npm test
```

Keep changes focused and add tests for data rules or API behaviour.

## Public-repository safety

Never commit:

- API tokens, passwords, cookies or private keys;
- personal phone numbers, email addresses or private chat IDs;
- private government or media contacts;
- unpublished tips or source identities;
- production database exports or user request logs.

Use `.dev.vars` or `.env` locally. Store deployment secrets in the hosting provider's encrypted secrets facility.
