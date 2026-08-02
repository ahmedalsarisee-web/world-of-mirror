# بطاقة إضافة طلب — نسخة احتياطية

**تاريخ الحفظ:** 4 يونيو 2026  
**المجلد:** `snapshots/add-order-card/`

---

## كيف تسترجعها لاحقاً؟

قل للمساعد:

> **«استرجع لي بطاقة إضافة طلب من snapshots/add-order-card»**

أو:

> **«طبّق نسخة بطاقة إضافة الطلب»**

---

## ماذا تشمل هذه النسخة؟

### 1. بطاقة الدخول من صفحة الطلبات (`OrdersHomeScreen`)

- بطاقة **التسعير** (`mirrorPricing`) → تفتح `MirrorPricingScreen`

### 2. صفحة التسعير — البطاقات (`MirrorPricingScreen`)

| البطاقة | الوجهة |
|---------|--------|
| **إضافة إلى السلة** | `MirrorPricingAddToCartScreen` |
| **إضافات تقليدية** | نافذة منبثقة + `MirrorPricingCustomAdditionsSection` |
| **قائمة الأسعار** | `MirrorPricingPriceListScreen` (خارج هذه النسخة) |

- زر السلة العائم `MirrorPricingCartFab` + `MirrorPricingCartPanel`

### 3. صفحة إضافة إلى السلة (`MirrorPricingAddToCartScreen`)

المحتوى الكامل داخل الصفحة:

- **`MirrorPricingCalculatorPanel`** (`variant="cart"`)
  - إدخال الطول والعرض
  - اختيار السُمك (4 مم / 6 مم)
  - عرض المساحة والمحيط والسُمك
  - **`MirrorPricingAddToCartSection`**
    - اختيار نوع الطلب (قائمة منبثقة)
    - الكمية وملاحظة الصنف
    - مجموع السطر + زر «إضافة إلى السلة»
- زر السلة العائم + تأكيد الطلب

### 4. إضافات تقليدية (`MirrorPricingCustomAdditionsSection`)

- وضع `embedded` داخل نافذة منبثقة من صفحة التسعير
- إضافة اسم + سعر + كمية
- قائمة الإضافات المضافة

### 5. التنقل (`PricingNavigator`)

- مسارات: `OrdersHome` → `MirrorPricing` → `MirrorPricingAddToCart`

---

## الملفات المحفوظة

```
snapshots/add-order-card/
├── README.md
└── src/
    ├── screens/pricing/
    │   ├── OrdersHomeScreen.tsx          ← بطاقة التسعير في صفحة الطلبات
    │   ├── MirrorPricingScreen.tsx         ← بطاقات التسعير (إضافة / إضافات / أسعار)
    │   └── MirrorPricingAddToCartScreen.tsx ← صفحة إضافة الطلب كاملة
    ├── components/pricing/
    │   ├── MirrorPricingCalculatorPanel.tsx      ← الأبعاد + الحاسبة
    │   ├── MirrorPricingAddToCartSection.tsx     ← اختيار الصنف + الإضافة للسلة
    │   └── MirrorPricingCustomAdditionsSection.tsx ← إضافات تقليدية
    ├── navigation/
    │   └── PricingNavigator.tsx
    ├── types/
    │   └── navigation.ts                   ← PricingStackParamList
    └── I18n/
        ├── ar-pricing-add-order-keys.json  ← مفاتيح الترجمة ذات الصلة (عربي)
        └── en-pricing-add-order-keys.json  ← مفاتيح الترجمة ذات الصلة (إنجليزي)
```

---

## استرجاع يدوي (PowerShell)

من جذر المشروع:

```powershell
Copy-Item "snapshots\add-order-card\src\screens\pricing\MirrorPricingScreen.tsx" "src\screens\pricing\" -Force
Copy-Item "snapshots\add-order-card\src\screens\pricing\MirrorPricingAddToCartScreen.tsx" "src\screens\pricing\" -Force
Copy-Item "snapshots\add-order-card\src\screens\pricing\OrdersHomeScreen.tsx" "src\screens\pricing\" -Force
Copy-Item "snapshots\add-order-card\src\components\pricing\MirrorPricingCalculatorPanel.tsx" "src\components\pricing\" -Force
Copy-Item "snapshots\add-order-card\src\components\pricing\MirrorPricingAddToCartSection.tsx" "src\components\pricing\" -Force
Copy-Item "snapshots\add-order-card\src\components\pricing\MirrorPricingCustomAdditionsSection.tsx" "src\components\pricing\" -Force
Copy-Item "snapshots\add-order-card\src\navigation\PricingNavigator.tsx" "src\navigation\" -Force
```

> **تنبيه:** `OrdersHomeScreen.tsx` و `PricingNavigator.tsx` قد يختلفان عن نسختك الحالية إذا أُضيفت بطاقات طلبات أخرى لاحقاً — راجع الفروقات قبل الاستبدال الكامل.

---

## ما لا تشمله هذه النسخة

- `MirrorPricingCartPanel` / `MirrorPricingCartFab` (السلة نفسها)
- `mirrorPricingCartStore.ts` (مخزن السلة)
- `MirrorPricingPriceListScreen`
- شاشات الطلبات المؤكدة والنقل بين البطاقات

---

## مفاتيح ترجمة أساسية

| المفتاح | العربية |
|---------|---------|
| `mirrorCartAddSection` | إضافة إلى السلة |
| `mirrorPricingAddToCartHint` | أدخل الأبعاد وأضف الأصناف إلى السلة |
| `mirrorCartCustomAdditions` | إضافات تقليدية |
| `mirrorPricingDimensions` | أبعاد المرايا |
| `mirrorCartAddToCart` | إضافة إلى السلة |
| `mirrorCartChooseOption` | اختر نوع الطلب |

(القائمة الكاملة في `src/I18n/ar-pricing-add-order-keys.json`)

---

*نسخة: **بطاقة إضافة طلب** — محفوظة للاسترجاع بجميع تفاصيلها.*
