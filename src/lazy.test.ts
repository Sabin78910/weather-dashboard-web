import app from "./App.tsx?raw";


test("below-the-fold code is split out with dynamic import()", () => {
  expect(app).toMatch(/lazy\(\(\) => import\("\.\/components\/SyncPanel"\)\)/);
  expect(app).toMatch(/lazy\(\(\) => import\("\.\/components\/Daily"\)\)/);
  expect(app).not.toMatch(/^import (SyncPanel|Daily) from/m);
});
