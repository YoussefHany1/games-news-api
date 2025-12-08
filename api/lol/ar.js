const axios = require("axios");
const cheerio = require("cheerio");

// دالة مساعدة للبحث داخل الـ JSON المعقد عن كائن يحتوي على العنوان والصورة
function findArticleImage(obj, targetTitle) {
  if (!obj || typeof obj !== "object") return null;

  // تنظيف العنوان للمقارنة
  const cleanTarget = targetTitle.toLowerCase().trim();

  // التحقق إذا كان الكائن الحالي هو المقالة المطلوبة
  if (obj.title && typeof obj.title === "string") {
    if (obj.title.toLowerCase().trim() === cleanTarget) {
      // وجدنا المقالة! الآن نبحث عن الصورة بداخلها
      // الاحتمالات الشائعة لمكان الصورة في بيانات Sanity/Next.js
      if (obj.image && obj.image.url) return obj.image.url;
      if (obj.banner && obj.banner.url) return obj.banner.url;
      if (obj.thumbnail && obj.thumbnail.url) return obj.thumbnail.url;
      if (obj.media && obj.media.url) return obj.media.url;

      // بحث عميق عن أي رابط صورة داخل كائن المقالة هذا فقط
      const deepImage = findImageInObject(obj);
      if (deepImage) return deepImage;
    }
  }

  // البحث في الأبناء (Recursion)
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = findArticleImage(obj[key], targetTitle);
      if (result) return result;
    }
  }
  return null;
}

// دالة مساعدة لاستخراج رابط صورة من كائن (إذا لم تكن في المفاتيح المباشرة)
function findImageInObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.url && typeof obj.url === "string" && obj.url.includes("cmsassets"))
    return obj.url;

  for (const key in obj) {
    const res = findImageInObject(obj[key]);
    if (res) return res;
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");

  try {
    const url = "https://www.leagueoflegends.com/ar-ae/news/";

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const $ = cheerio.load(data);

    // 1. استخراج بيانات Next.js المخفية
    let nextData = null;
    try {
      const scriptContent = $("#__NEXT_DATA__").html();
      if (scriptContent) {
        nextData = JSON.parse(scriptContent);
      }
    } catch (e) {
      console.log("Failed to parse __NEXT_DATA__", e);
    }

    const articles = [];

    $('a[data-testid="articlefeaturedcard-component"]').each(
      (index, element) => {
        const linkAttr = $(element).attr("href");
        const fullLink = linkAttr.startsWith("http")
          ? linkAttr
          : `https://www.leagueoflegends.com${linkAttr}`;

        const title = $(element)
          .find('[data-testid="card-title"]')
          .text()
          .trim();
        const category = $(element)
          .find('[data-testid="card-category"]')
          .text()
          .trim();
        const date = $(element).find("time").attr("datetime");
        const description = $(element)
          .find('[data-testid="card-description"]')
          .text()
          .trim();

        // 2. محاولة جلب الصورة من البيانات المستخرجة (الأكثر دقة)
        let imageUrl = null;
        if (nextData) {
          imageUrl = findArticleImage(nextData, title);
        }

        // 3. (خطة بديلة) إذا فشل الـ JSON، نحاول البحث في الـ HTML كالسابق
        if (!imageUrl) {
          const imgElement = $(element).find("img");
          const srcset =
            imgElement.attr("srcset") || imgElement.attr("data-srcset");
          if (srcset) imageUrl = srcset.split(",")[0].trim().split(" ")[0];
          if (!imageUrl) imageUrl = imgElement.attr("data-src");
          if (
            !imageUrl &&
            imgElement.attr("src") &&
            !imgElement.attr("src").startsWith("data:")
          ) {
            imageUrl = imgElement.attr("src");
          }
        }

        articles.push({
          title,
          category,
          date,
          description,
          link: fullLink,
          image: imageUrl || "IMAGE_NOT_FOUND_IN_JSON_OR_HTML", // رسالة خطأ واضحة
        });
      }
    );

    res.status(200).json({
      status: "success",
      cached_at: new Date().toISOString(),
      count: articles.length,
      data: articles,
    });
  } catch (error) {
    console.error("Error scraping data:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to scrape data",
      error: error.message,
    });
  }
};
