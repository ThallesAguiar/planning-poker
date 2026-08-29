# REST Contract

Base URL: `/`. JSON responses. Mutations validate payloads and return user-safe errors.

## Rooms

- `POST /rooms`: create public/private room; request name, visibility, optional password, optional
  configuration; response ID, invite code, name, visibility.
- `GET /rooms/:idOrCode`: safe metadata, configuration, ordered stories, status; never password hash
  or secret values.
- `PATCH /rooms/:id`: update allowed configuration; PO session and lobby required.
- `POST /rooms/:id/join`: optional guest/JWT session bootstrap; returns signed session token and
  participant identity after private access validation.

## Stories

- `POST /rooms/:id/stories`: create title/description; PO only.
- `PATCH /rooms/:id/stories/:storyId`: update title, description, or order before active round; PO.
- `GET /rooms/:id/stories`: ordered stories and safe outcomes.

## Reports

- `POST /rooms/:id/report`: authorized close and generate report.
- `GET /rooms/:id/reports`: list reports for participants with a valid room session.
- `GET /reports/:reportId`: report page data for participants with a valid room session.
- `GET /reports/:reportId/export.csv`: CSV download for PO or authorized Scrum Master.
- `GET /reports/:reportId/export.pdf`: PDF download for PO or authorized Scrum Master.

## Error contract

```json
{
  "code": "FORBIDDEN",
  "message": "You do not have permission to perform this action",
  "details": {}
}
```

HTTP status maps to validation (`400`), authentication (`401`), authorization (`403`), missing
resource (`404`), conflict (`409`), and provider/service failure (`503`). Responses never contain
password hashes, JWT secrets, provider keys, or hidden vote values.
