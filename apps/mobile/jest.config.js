// 모바일 화면 테스트(tests/). Expo가 안내하는 jest-expo 설정을 쓰고, 앱 번들(Metro)과 따로 돈다.
// tsconfig의 경로 별칭(@/*)을 테스트에서도 같게 푼다.
// expo-modules-core는 npm이 expo 패키지 안쪽(node_modules/expo/node_modules)에만 설치한다. 앱 번들은 Expo의
// 자동 연결 해석기가 그 복사본으로 찾아 주므로, 테스트도 같은 복사본을 쓰게 한다.
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
  moduleNameMapper: {
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^expo-modules-core$": "<rootDir>/node_modules/expo/node_modules/expo-modules-core",
    "^expo-modules-core/(.*)$": "<rootDir>/node_modules/expo/node_modules/expo-modules-core/$1"
  }
};
