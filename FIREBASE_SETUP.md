# Firebase Setup

## 1. Create Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project and enable **Authentication** (Email/Password)
3. Create a **Firestore** database
4. Create **Storage** bucket

## 2. App configuration

Copy `.env.example` to `.env` and fill in values from Project Settings → Your apps → Web app config.

```bash
cp .env.example .env
```

Restart Expo after changing `.env`.

## 3. Deploy security rules

```bash
firebase deploy --only firestore:rules,storage
```

Or paste `firestore.rules` into the Firestore Rules tab in the console.

## 4. Create users

For each employee/admin:

1. Authentication → Add user (email + password)
2. Firestore → `users` collection → document ID = Auth UID:

```json
{
  "name": "Abdullah",
  "role": "employee",
  "balance": 0,
  "createdAt": "2026-05-23T00:00:00.000Z"
}
```

Admin example:

```json
{
  "name": "Admin",
  "role": "admin",
  "balance": 0,
  "createdAt": "2026-05-23T00:00:00.000Z"
}
```

## 5. Firestore composite indexes

Create these composite indexes when prompted by Firebase (or in Firestore → Indexes):

| Collection     | Fields                                      |
|----------------|---------------------------------------------|
| orders         | status ASC, createdAt DESC                  |
| orders         | status ASC, employeeId ASC, createdAt DESC  |
| transactions   | userId ASC, createdAt DESC                  |
| products       | updatedAt DESC                              |

## 6. Storage rules (example)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
