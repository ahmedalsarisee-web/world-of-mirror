# مالية 3 — نسخة احتياطية

**تاريخ الحفظ:** 23 مايو 2026  
**المجلد:** `snapshots/malia-3/`

---

## كيف تسترجعها لاحقاً؟

قل للمساعد:

> **«استرجع لي مالية 3»**

أو:

> **«طبّق نسخة مالية 3 من snapshots/malia-3»**

---

## ملخص سلوك صفحة المالية (مالية 3)

### المدير — `FinanceHomeScreen`

1. **عنوان + تصدير PDF**
2. **إجمالي الرصيد النقدي** — `FinanceSummaryCards` (وارد / صادر / الإجمالي)
3. **جميع الحسابات** — `FinanceAccountsList`
   - النقر على موظف أو حساب المدير نفسه → `EmployeeFinanceHub`
   - مدير آخر (عرض فقط) → `EmployeeAccount`
4. **البطاقات الإضافية** (أسفل الصفحة) — `FinanceCustomLedgersSection`
   - بطاقات مالية مخصصة **لحساب المدير فقط**
   - زر «إضافة بطاقة معاملات مالية» مع تسمية عند الإنشاء
   - البطاقة الجديدة تظهر **في الأسفل دائماً** (ترتيب حسب `createdAt`)
   - فتح البطاقة → `EmployeeCustomLedgerScreen` (قائمة ⋮: مسح، إعادة تسمية، حذف)

### الموظف — نفس الشاشة

- يعرض `EmployeeFinanceHubPanel` مباشرة (بطاقة الرصيد + سلف + بطاقات إضافية + إضافة)

### صفحة حساب الموظف/المدير — `EmployeeFinanceHub`

- بطاقة **الرصيد الحالي** (ثابتة)
- بطاقة **سلف الراتب** (legacy — تظهر فقط إن وُجدت معاملات قديمة)
- **البطاقات الإضافية** + زر الإضافة (للمدير على موظفين وحسابه)
- تصدير كشف حساب

---

## نموذج البيانات

| العنصر | التخزين |
|--------|---------|
| بطاقة الرصيد الحالي | ثابتة — `financeCardLabels.cash` اختياري |
| سلف legacy | معاملات `advance` / `advance_repayment` |
| بطاقات مخصصة | `users/{userId}.financeLedgers[]` |
| معاملات البطاقة | `ledger_debit` / `ledger_credit` + `ledgerId` |

---

## الملفات الأساسية (الأهم)

| الملف | الدور |
|-------|-------|
| `src/screens/finance/FinanceHomeScreen.tsx` | الصفحة الرئيسية للمدير |
| `src/components/finance/FinanceCustomLedgersSection.tsx` | قسم بطاقات المدير في الأسفل |
| `src/components/finance/EmployeeFinanceHubPanel.tsx` | لوحة بطاقات داخل حساب موظف/مدير |
| `src/components/finance/FinanceAccountsList.tsx` | قائمة الحسابات |
| `src/screens/finance/EmployeeCustomLedgerScreen.tsx` | شاشة بطاقة مخصصة + ⋮ |
| `src/utils/financeLedgers.ts` | ألوان، IDs، **`sortFinanceLedgersByCreatedAt`** |
| `src/utils/financePermissions.ts` | `canManageFinanceLedgers` |
| `src/services/users.service.ts` | `addFinanceLedger`, `renameFinanceLedger`, `deleteFinanceLedger` |
| `src/navigation/FinanceNavigator.tsx` | مسارات المالية |

---

## الصلاحيات

- **`canManageFinanceLedgers`:** مدير + يدير الحساب + (موظف **أو** حساب المدير نفسه)
- إضافة بطاقات على الصفحة الرئيسية: **حساب المدير الحالي فقط**
- إضافة بطاقات للموظفين: من `EmployeeFinanceHub` بعد النقر على الموظف

---

## مفاتيح الترجمة (أهمها)

```json
"globalCashBalance": "إجمالي الرصيد النقدي"
"allAccounts": "جميع الحسابات"
"customFinanceCards": "البطاقات الإضافية"
"addFinanceLedger": "إضافة بطاقة معاملات مالية"
"addFinanceLedgerHint": "أضف بطاقات للسلف أو أي رصيد منفصل..."
```

(الملفات الكاملة في `src/I18n/ar/translation.json` و `en/translation.json`)

---

## هيكل المجلد

```
snapshots/malia-3/
├── README.md                          ← هذا الملف
└── src/
    ├── screens/finance/               ← كل شاشات المالية
    ├── components/finance/            ← كل مكوّنات المالية
    ├── utils/                         ← financeLedgers, financePermissions, financeTotals, ...
    ├── services/                      ← users.service, transactions.service
    ├── hooks/useFinanceCardHeaderMenu.tsx
    ├── navigation/FinanceNavigator.tsx
    ├── types/navigation.ts, models.ts
    └── I18n/ar|en/translation.json
```

---

## استرجاع يدوي (PowerShell)

من جذر المشروع:

```powershell
Copy-Item "snapshots\malia-3\src\screens\finance\*" "src\screens\finance\" -Recurse -Force
Copy-Item "snapshots\malia-3\src\components\finance\*" "src\components\finance\" -Recurse -Force
Copy-Item "snapshots\malia-3\src\utils\finance*" "src\utils\" -Force
Copy-Item "snapshots\malia-3\src\utils\transactionLabels.ts" "src\utils\" -Force
Copy-Item "snapshots\malia-3\src\services\users.service.ts" "src\services\" -Force
Copy-Item "snapshots\malia-3\src\services\transactions.service.ts" "src\services\" -Force
Copy-Item "snapshots\malia-3\src\hooks\useFinanceCardHeaderMenu.tsx" "src\hooks\" -Force
Copy-Item "snapshots\malia-3\src\navigation\FinanceNavigator.tsx" "src\navigation\" -Force
Copy-Item "snapshots\malia-3\src\types\navigation.ts" "src\types\" -Force
Copy-Item "snapshots\malia-3\src\types\models.ts" "src\types\" -Force
```

> **تنبيه:** ملفات الترجمة الكاملة مُنسخة أيضاً — استرجعها فقط إذا أردت نفس النصوص حرفياً، لأن `translation.json` يحتوي مفاتيح التطبيق كله.

---

## ما **لا** تشمله هذه النسخة

- قواعد Firestore (`firestore.rules`)
- `mockDb` / بيانات تجريبية
- مكوّنات خارج مجلد المالية (مثل `ScreenContainer`, `AppButton`)

---

*نسخة: **مالية 3** — محفوظة للاسترجاع.*
