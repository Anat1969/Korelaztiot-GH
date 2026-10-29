# קורלציות: מעבדה עירונית, עיריית אשדוד

מה הולך יחד עם מה בעיר, וכמה אפשר לסמוך על זה.

25 מדדים לשלוש יחידות ניתוח קבועות (35 רובעים רשמיים, 75 משושי H3 ברזולוציה 8, 530 משושים ברזולוציה 9), מחמישה מקורות:
Landsat 9 (טמפרטורת פני שטח), Sentinel-2 (NDVI, NDBI, NDWI), Overture Maps (מבנים, דרכים, שימושי קרקע, עסקים), ו-ASHDODMAP של העירייה (חינוך, שימור, התחדשות, תוכנית מתאר).

לכל זוג משתנים: Pearson, Spearman, מבחן תמורות, bootstrap, תיקון לאוטוקורלציה מרחבית (Moran's I ומדגם אפקטיבי), קורלציה חלקית, LISA דו-משתני, עקביות בין קני מידה ומדד אמינות. המטריצה מתוקנת לבדיקות מרובות (Benjamini-Hochberg).

## הרצה

```bash
npm install
npm run dev
```

## נתונים

```bash
pip install rasterio duckdb h3 shapely pyproj numpy
python3 scripts/fetch_muni.py && npm run data
```

הנתונים מתעדכנים אוטומטית פעם בחודש (`.github/workflows/refresh-data.yml`).

## בדיקות

```bash
npm test
npm run build && npm run e2e
```
