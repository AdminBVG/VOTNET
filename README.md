# VOTNET

## Configuration

Sensitive values are not stored in source control. The following placeholders in
`BvgAuthApi/appsettings.json` must be provided at runtime through environment
variables or a secrets manager:

| Placeholder | Environment variable |
|-------------|----------------------|
| `${DB_CONN}` | `DB_CONN` |
| `${JWT_KEY}` | `JWT_KEY` |
| `${ADMIN_EMAIL}` | `ADMIN_EMAIL` |
| `${ADMIN_PASSWORD}` | `ADMIN_PASSWORD` |

Example configuration on Linux or macOS:

```bash
export DB_CONN="Host=localhost;Port=5432;Database=bvg_auth;Username=bvg_user;Password=secret"
export JWT_KEY="change-this-key"
export ADMIN_EMAIL="admin@bvg.local"
export ADMIN_PASSWORD="S3cureP@ss"
dotnet run --project BvgAuthApi
```

On Windows PowerShell replace `export` with `$env:VAR = "value"`.

In production use a secrets manager or deployment environment to supply these
values securely.

