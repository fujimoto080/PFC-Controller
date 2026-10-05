import { SESSION_COOKIE, createSession } from '../e2e/session.ts';

// CI の Lighthouse 計測用。E2E 用 DB にユーザーを作り、LIGHTHOUSE_COOKIE に渡す Cookie を標準出力へ出す。
// ユーザーは使い捨ての DB ごと破棄されるため削除しない。
const session = await createSession();
console.log(`${SESSION_COOKIE}=${session.token}`);
process.exit(0);
