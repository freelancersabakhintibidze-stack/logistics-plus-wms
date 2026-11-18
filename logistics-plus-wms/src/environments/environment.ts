// The SPA calls the API on the same origin, so no credentialed cross-origin
// configuration and no credential is ever bundled into browser code.
export const environment = {
  production: true,
  apiBase: ''
};
