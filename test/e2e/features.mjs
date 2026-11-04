// feature name -> checks. Add a feature: new key with { name, path, status?, includes: [text...] }
export const features = {
  home: [
    { name: "GET / returns 200", path: "/", status: 200 },
    { name: "page declares Thai language", path: "/", includes: ['lang="th"'] },
    { name: "title is Bill Gen", path: "/", includes: ["<title>Bill Gen</title>"] },
    { name: "heading h1 says Bill Gen", path: "/", includes: [">Bill Gen</h1>"] },
  ],
};
