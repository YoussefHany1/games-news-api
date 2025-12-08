const axios = require("axios");
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  // إعدادات الكاش (Cache) لتسريع الاستجابة في المرات القادمة
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");

  try {
    const url = "https://www.ea.com/games/ea-sports-fc/fc-26/news";

    // جلب محتوى الصفحة
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const $ = cheerio.load(data);
    const articles = [];

    // البحث عن جميع الروابط التي تؤدي إلى أخبار FC 26
    // نستخدم has('h3') للتأكد من أن الكارد يحتوي على عنوان (لتجنب الروابط العشوائية)
    $('a[href*="/games/ea-sports-fc/fc-26/news"]')
      .has("h3")
      .each((index, element) => {
        const linkAttr = $(element).attr("href");

        // بناء الرابط الكامل
        const fullLink = linkAttr.startsWith("http")
          ? linkAttr
          : `https://www.ea.com${linkAttr}`;

        // استخراج العنوان (موجود داخل h3)
        const title = $(element).find("h3").text().trim();

        // استخراج التاريخ (موجود في عنصر span قبل العنوان مباشرة حسب الكود المرفق)
        // نستخدم prev() للبحث عن العنصر السابق للعنوان
        const date = $(element).find("h3").prev().text().trim();

        // استخراج التصنيف (Category)
        // نبحث عن div يحتوي على كلمة "News" أو نأخذ أول نص داخل التاجات
        let category = "News";
        const tagText = $(element)
          .find("div[class*='Tag_tagInner']")
          .text()
          .trim();
        if (tagText) category = tagText;

        // استخراج الصورة
        const imgElement = $(element).find("img");
        let imageUrl = imgElement.attr("src");

        // أحياناً تكون الصورة داخل data-src أو srcset
        if (!imageUrl) imageUrl = imgElement.attr("data-src");

        // إضافة الخبر للقائمة إذا كان يحتوي على عنوان ورابط
        if (title && fullLink) {
          articles.push({
            title,
            category,
            date,
            description: "", // الوصف غير متاح بوضوح في الكارد الخارجي
            link: fullLink,
            image: imageUrl || null,
          });
        }
      });

    res.status(200).json({
      status: "success",
      cached_at: new Date().toISOString(),
      count: articles.length,
      data: articles,
    });
  } catch (error) {
    console.error("Error scraping EA FC data:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to scrape data",
      error: error.message,
    });
  }
};
