# מערכת סידור עבודה לגלידרייה

פרויקט Full-Stack:
- Backend: Node.js + Express
- Frontend: React + Vite

## יכולות עיקריות
- הזנת עובדים וזמינויות לפי יום וטווח שעות.
- סימון עובד כאחמ"ש.
- סימון עובד עם עדיפות לקבל יותר משמרות.
- יצירת סידור אוטומטי לפי זמינות, דרישות אחמ"ש, ואיזון יחסי לכמות האופציות שנשלחו.
- עריכה ידנית של השיבוץ לאחר יצירת הסידור.

## הרצה מקומית

### 1) Backend
```bash
cd backend
npm install
npm run dev
```
ברירת מחדל: רץ על `http://localhost:4000`
ניתן להגדיר:
- `PORT` ו-`CORS_ORIGIN` בקובץ `.env` (יש דוגמה ב-`.env.example`)

### 2) Frontend
```bash
cd frontend
npm install
npm run dev
```
ברירת מחדל: רץ על `http://localhost:5173`
ניתן להגדיר:
- `VITE_API_URL` בקובץ `.env` (יש דוגמה ב-`.env.example`) כדי להצביע על ה-API בפרודקשן

## API
`POST /api/schedule/generate`

Body:
```json
{
  "employees": [
    {
      "id": "1",
      "name": "יוסי",
      "isManager": true,
      "preferredForMoreShifts": false,
      "availability": [
        { "day": "sunday", "start": "10:00", "end": "24:00" }
      ]
    }
  ]
}
```
