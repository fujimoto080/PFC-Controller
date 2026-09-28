/** E2E テスト用の接続先と認証設定。アプリ（webServer）とテスト側の両方で使う。 */
export const E2E_PORT = 3210;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL =
  'postgres://postgres:postgres@localhost:54329/pfc_e2e';
export const E2E_AUTH_SECRET = 'e2e-auth-secret-not-for-production';
