export const environment = {
  azureClientId: import.meta.env.NG_APP_AZURE_AD_CLIENT_ID || '',
  azureTenantId: import.meta.env.NG_APP_AZURE_AD_TENANT_ID || '',
  azureRedirectUri: import.meta.env.NG_APP_AZURE_AD_REDIRECT_URI || window.location.origin
};
