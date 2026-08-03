/**
 * @deprecated 레거시 엔트리 — 프로덕션은 `src/index.ts` → `bootstrap.ts` 만 사용.
 * 열린 CORS(cors()) 풋건을 막기 위해 기동을 거부한다.
 */
export const createApp = (): never => {
  throw new Error(
    "레거시 src/app.ts는 더 이상 사용하지 않습니다. src/index.ts(bootstrap)로 기동하세요.",
  );
};
