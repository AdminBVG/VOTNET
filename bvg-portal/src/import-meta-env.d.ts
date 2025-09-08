interface ImportMetaEnv {
  readonly NG_APP_AZURE_AD_CLIENT_ID: string;
  readonly NG_APP_AZURE_AD_TENANT_ID: string;
  readonly NG_APP_AZURE_AD_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

