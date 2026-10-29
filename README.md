# קורלציות: מעבדה עירונית, עיריית אשדוד

**[korelaztiot.vercel.app](https://korelaztiot.vercel.app)**

המיזוג האחרון, בלי Vercel: [raw.githack](https://raw.githack.com/Anat1969/Korelaztiot-GH/main/app/index.html) (בפעם הראשונה ייתכן דף ביניים: לוחצים Open the page).

כלי אחד לשש פעולות: מדידה, ידיעה, הבנה, תכנון, למידה ושימוש. המכונה מוצאת תלות תכנונית בין שכבות שלכאורה לא קשורות, ומחזירה כללי תכנון מועמדים עם מדד אמינות.

29 מדדים לשלוש יחידות ניתוח קבועות (35 רובעים רשמיים, 75 משושי H3 ברזולוציה 8, 530 משושים ברזולוציה 9), מחמישה מקורות:
Landsat 9 (טמפרטורת פני שטח), Sentinel-2 (NDVI, NDBI, NDWI), Overture Maps (מבנים, דרכים, שימושי קרקע, עסקים), מאגר התחנות של משרד התחבורה, ו-ASHDODMAP של העירייה (חינוך, שימור, התחדשות, תוכנית מתאר).

לכל זוג משתנים: Pearson, Spearman, מבחן תמורות, bootstrap, תיקון לאוטוקורלציה מרחבית (Moran's I ומדגם אפקטיבי), קורלציה חלקית, LISA דו-משתני, עקביות בין קני מידה ומדד אמינות. המטריצה מתוקנת לבדיקות מרובות (Benjamini-Hochberg).

## הרצה

```bash
npm install
npm run dev
```

## נתונים

```bash
pip install rasterio duckdb h3 shapely pyproj numpy scipy
python3 scripts/fetch_muni.py && npm run data
```

הנתונים מתעדכנים אוטומטית פעם בחודש (`.github/workflows/refresh-data.yml`).

## בדיקות

```bash
npm test
npm run build && npm run e2e
```
