# Bvg Portal

## Requisitos

- Node.js 20+
- Angular CLI 18

## Instalación

```bash
cd bvg-portal
npm install
```

## Configuración de Microsoft 365

Antes de iniciar la aplicación establece las siguientes variables de entorno con los valores de tu registro en Azure AD:

```bash
export NG_APP_AZURE_AD_CLIENT_ID="<client-id>"
export NG_APP_AZURE_AD_TENANT_ID="<tenant-id>"
export NG_APP_AZURE_AD_REDIRECT_URI="http://localhost:4200"
```

El logo mostrado en el portal y en el formulario de acceso puede personalizarse desde la sección de **Configuración** dentro de la aplicación, estableciendo un enlace en el campo *Logo URL*.

## Desarrollo

```bash
npm start
```

La aplicación se servirá en `http://localhost:4200` y se comunicará con el backend a través de rutas relativas (`/api`).
