// feature name -> checks. Add a feature: new key with { name, path, status?, includes: [text...] }
export const features = {
  home: [
    { name: "GET / returns 200", path: "/", status: 200 },
    { name: "page declares Thai language", path: "/", includes: ['lang="th"'] },
    { name: "title is Bill Gen", path: "/", includes: ["<title>Bill Gen</title>"] },
    { name: "home is the chat page", path: "/", includes: ['aria-label="รายการแชต"', 'aria-label="ข้อความ"'] },
    { name: "/edit is not found", path: "/edit", status: 404, includes: ["ไม่พบหน้า"] },
  ],
};
