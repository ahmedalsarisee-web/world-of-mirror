# Mirror catalog source images

ضع صور كتالوج المرايا هنا. يمكنك الترتيب **بشكل مسطح** أو داخل مجلدات السلسلة:

```
all-mirror/
  a/
    a02.jpg
    a04.jpg
  b/
    b02.jpg
  menu/
    menu2.jpg
```

أو مباشرة:

```
all-mirror/
  a02.jpg
  b02.jpg
  menu2.jpg
```

## بعد أي تعديل

```bash
npm run prepare:mirror-catalog
```

يُنشئ هذا:

- `assets/mirror-catalog/thumbs/` — للمنتقي وقوائم إضافة الطلب (الاستديو)
- `assets/mirror-catalog/display/` — للمعاينة وكتابة النص
- `src/data/mirrorCatalogImages.ts` — فهرس التطبيق

ثم أعد تشغيل Expo مع مسح الكاش: `npx expo start -c`

## تسمية الملفات

- سلسلة **A** → `a02.jpg`, `a04.jpg`, …
- سلسلة **B** → `b02.jpg`, …
- القائمة → `menu2.jpg`

اسم الملف (مثل `a02.jpg`) هو المعرّف المحفوظ مع الطلب — لا تغيّره بعد نشر الطلبات إلا إذا استبدلت الصورة بنفس الاسم.
