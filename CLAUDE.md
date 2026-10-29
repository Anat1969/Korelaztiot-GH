# קורלציות (Korelaztiot-GH)

מעבדה עירונית לעיריית אשדוד: מצליבה מדדי לוויין, בינוי, תנועה, שירותים, חינוך ותכנון ברמת רובע ומשושה, ומודדת את מהימנות כל קשר.
לפני כל שינוי: לקרוא את הקובץ הזה. אחרי כל תיקון של ענת: להוסיף אותו כאן, בסעיף "תיקונים של ענת".

## בעלות ולוגו
- האפליקציה שייכת לעיריית אשדוד. כפתור הלוגו: `<ai-menu brand="ashdod" chat="...">` (תקן: github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md).
- לוגו העירייה מופיע גם בדף הנחיתה (`public/ashdod-logo.png`, הועתק מ-appofapp-gh.vercel.app/ashdod-logo.png).
- בסרגל העליון רק: שם האפליקציה (קישור לדף הבית), ניווט תוכן, וכפתור הלוגו. פעולות עריכה נכנסות דרך `menu.items` ב-`src/components/Layout.tsx`.

## אישורים קבועים
- ענת אישרה מיזוג קבוע: אחרי בדיקה ירוקה, למזג PR ל-main בלי לשאול.
- Supabase: פרויקט ASHDODMAP (`cbhexpybdggwzyakgagd`), משותף לאפליקציות עירוניות. כל הטבלאות והפונקציות בקידומת `kr_`.

## מבנה
- `scripts/` צנרת נתונים (Python): `fetch_muni.py` (ASHDODMAP), `fetch_overture.py` (Overture Maps דרך DuckDB), `fetch_rasters.py` (Landsat 9 מ-Planetary Computer, Sentinel-2 מ-Earth Search), `build_data.py` (מדדים לכל יחידה) -> `public/data/*.json`.
- `.github/workflows/refresh-data.yml` מריץ את הצנרת ב-2 לכל חודש, בודק build ובדיקות, ודוחף ל-main (פריסה אוטומטית).
- `src/lib/stats.ts` מנוע סטטיסטי טהור; `stats.worker.ts` מריץ אותו ב-Web Worker. `tests/stats.test.ts` משווה ל-SciPy.
- `src/lib/variables.ts` קטלוג המשתנים (שם, יחידה, מקור, הסבר). משתנה חדש: להוסיף ל-`build_data.py` ולקטלוג.
- `src/lib/narrative.ts` פרשנות בעברית. `src/lib/store.ts` ממצאים ועדכונים ב-Supabase עם גיבוי מקומי.
- דפים: נחיתה, מעבדה, מטריצה, אטלס, ממצאים, שיטה, מה חדש.

## עריכה
- אין Google OAuth בפרויקט. עריכה לפי מפתח עורך: `?edit=<key>` בכתובת שומר את המפתח בדפדפן ומוחק אותו מהכתובת. בבסיס הנתונים נשמר רק hash (`kr_editor_keys`), והכתיבה רק דרך פונקציות `kr_save_finding`, `kr_remove_finding`, `kr_save_update` (security definer).
- המיגרציה: `supabase/migrations/20261029_kr_korelaztiot_init.sql`.

## בדיקה ומסירה
- `npm test` (סטטיסטיקה מול SciPy), `npm run build`, `npm run e2e` (Playwright מול vite preview: כל הדפים, כל הכפתורים, אין גלילה אופקית בנייד, אין שגיאות התקנה, כפתור הלוגו קיים ואין כפתורי פיתוח חופשיים בסרגל).
- Vercel: פרויקט `korelaztiot`, ענף הייצור main.

## מלכודות שנפתרו
- MapLibre 6 מריץ worker מקובץ נפרד. אחרי bundling צריך `setWorkerUrl` עם `maplibre-gl-worker.mjs?url` (ב-`CityMap.tsx`). בלעדיו המפה ריקה.
- `map.isStyleLoaded()` מחזיר false כל עוד אריחים נטענים. לא להתנות בו הוספת שכבות; להסתמך על `style.load`.
- מספרים שליליים ו-"<" מתהפכים ב-RTL. כל מספר שמוצג עובר דרך `fr()` / `fmt()` / `fmtP()` שעוטפים אותו ב-LRI/PDI.
- תוצאת ניתוח קשורה ליחידות שעליהן חושבה (`pair.units`), אחרת מעבר יחידה מפיל את הדף.
- DuckDB קולט את מפתחות ה-AWS שהפרוקסי מזריק בסביבת Claude Code. להריץ עם `env -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY` ו-secret אנונימי (כבר בסקריפט).
- פיקסלי ים הופכים את הקשר בין צמחייה לחום. כל מדדי הלוויין מחושבים על יבשה בלבד (NDWI > 0 מוסתר). Sentinel-2 נבחר לפי קרבה בזמן לצילום ה-Landsat.
- גובה מבנים ב-Overture ידוע רק לכ-3% מהמבנים באשדוד, ולכן אין מדד גובה או FAR.
- `pkill -f "vite preview"` בתוך פקודה שמכילה את אותה מחרוזת הורג את המעטפת עצמה.
- Overpass ו-Open-Meteo חסומים מסביבת הבנייה. Overture ו-STAC זמינים.

## תיקונים של ענת
- (עוד אין)
