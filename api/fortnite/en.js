const axios = require("axios");
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  // إعدادات الكاش
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");

  try {
    // رابط صفحة أخبار فورتنايت
    const url = "https://www.fortnite.com/news?lang=en-US";

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const $ = cheerio.load(data);
    const articles = [];

    // البحث عن الكروت الخاصة بالأخبار
    // نعتمد هنا على الروابط التي تحتوي على "/news/" ولها عنوان h3
    $('a[href*="/news/"]').each((index, element) => {
      // التأكد أن العنصر يحتوي على عنوان h3 لتجنب الروابط الجانبية
      const titleElement = $(element).find("h3");
      if (titleElement.length === 0) return;

      const title = titleElement.text().trim();

      const linkAttr = $(element).attr("href");
      const fullLink = linkAttr.startsWith("http")
        ? linkAttr
        : `https://www.fortnite.com${linkAttr}`;

      // محاولة الوصول للعناصر المحيطة (التاريخ والصورة)
      // الهيكلية في الكود المرسل:
      // Container -> Image + TextWrapper -> [Date + Link(Title)] + [CategoryWrapper]

      // الصعود للأب الذي يحتوي التاريخ والرابط معاً
      const infoWrapper = $(element).parent();

      // التاريخ موجود في span قبل الرابط مباشرة في نفس الـ div
      const date = infoWrapper.find("span").first().text().trim();

      // الصعود لأعلى مستوى للكارد لجلب الصورة
      // نبحث عن أقرب div أب يحتوي على صورة
      const cardWrapper = $(element).closest("div._1m16vne2");
      // ملاحظة: _1m16vne2 هو كلاس الكارد الرئيسي في الكود المرسل
      // إذا لم نجده بالكلاس، نحاول الصعود 3 مستويات للأعلى كاحتياط
      const mainContainer = cardWrapper.length
        ? cardWrapper
        : $(element).parents("div").eq(2);

      const imgElement = mainContainer.find("img");
      let imageUrl = imgElement.attr("src");
      if (!imageUrl) imageUrl = imgElement.attr("data-src");

      // التصنيف (Category)
      // موجود في div يلي الـ infoWrapper
      const categoryWrapper = infoWrapper.next();
      const category = categoryWrapper.text().trim() || "Fortnite News";

      // إضافة الخبر
      if (title && fullLink) {
        articles.push({
          title,
          category,
          date,
          description: "", // الوصف غير متاح في الكارد الخارجي
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
    console.error("Error scraping Fortnite data:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to scrape data",
      error: error.message,
    });
  }
};
