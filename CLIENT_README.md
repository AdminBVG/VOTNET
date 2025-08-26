# VotNET Frontend

## Requisitos

- Node.js 20+
- Angular CLI 17

## Instalación

```bash
cd votnet-client
npm install
```

## Desarrollo

```bash
npm start
```

La aplicación se servirá en `http://localhost:4200` y consumirá el backend a través de `API_BASE_URL` definido en `src/environments`.

## Estructura del proyecto

- `src/app/login`: componentes de autenticación.
- `src/app/user-admin`: módulo para administración de usuarios.
- `src/app/elections`: módulo para gestión de elecciones y resultados.
- `src/app/services`: servicios compartidos.

## Estilos

Se utilizan temas de Angular Material con estilos globales en `src/styles.css`.

## Despliegue

Construir la aplicación con:

```bash
npm run build
```

El contenido generado en `dist/` puede desplegarse como archivos estáticos. Asegúrate de configurar CORS y la variable `API_BASE_URL` en el backend según el entorno.
