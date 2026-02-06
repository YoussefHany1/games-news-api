const axios = require("axios");

// دالة لاستخراج أول صورة من محتوى Steam
function extractImageFromHTML(htmlContent) {
  if (!htmlContent) return null;

  // البحث عن Steam [img] tags أولاً
  // Pattern: [img]{STEAM_CLAN_IMAGE}/path/image.png[/img]
  const steamImgRegex = /\[img\]\{STEAM_CLAN_IMAGE\}\/([^\[]+)\[\/img\]/i;
  const steamMatch = htmlContent.match(steamImgRegex);

  if (steamMatch && steamMatch[1]) {
    // استبدال {STEAM_CLAN_IMAGE} بالرابط الفعلي
    return `https://clan.steamstatic.com/images/${steamMatch[1]}`;
  }

  // البحث عن img src في الـ HTML (حالة احتياطية)
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const match = htmlContent.match(imgRegex);

  if (match && match[1]) {
    return match[1];
  }

  // البحث عن روابط الصور المباشرة (jpg, png, gif, webp)
  const urlRegex = /(https?:\/\/[^\s<>"]+?\.(jpg|jpeg|png|gif|webp))/i;
  const urlMatch = htmlContent.match(urlRegex);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  return null;
}

// دالة لتنظيف محتوى HTML من التاجات
function stripHTMLTags(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ") // إزالة جميع التاجات
    .replace(/\s+/g, " ") // تقليل المسافات المتعددة
    .trim();
}

module.exports = async (req, res) => {
  // إعدادات الكاش (Cache) لتسريع الاستجابة في المرات القادمة
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");

  try {
    // Steam API endpoint لـ EA FC 25
    // appid=3405690 هو الـ ID الخاص بـ EA SPORTS FC 25 على Steam
    const steamApiUrl =
      "https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=3405690&format=json&count=20";

    // جلب البيانات من Steam API
    const { data } = await axios.get(steamApiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const articles = [];

    // التحقق من وجود البيانات
    if (data.appnews && data.appnews.newsitems) {
      data.appnews.newsitems.forEach((item) => {
        // استخراج الصورة من المحتوى
        const imageUrl = extractImageFromHTML(item.contents);

        // تنظيف المحتوى من HTML للوصف
        const cleanDescription = stripHTMLTags(item.contents);

        // تحويل timestamp إلى ISO format
        const dateISO = new Date(item.date * 1000).toISOString();

        articles.push({
          title: item.title || "",
          category: item.feedlabel || "News",
          date: dateISO,
          description: cleanDescription,
          link: item.url || "",
          image: imageUrl,
        });
      });
    }

    res.status(200).json({
      status: "success",
      cached_at: new Date().toISOString(),
      count: articles.length,
      data: articles,
    });
  } catch (error) {
    console.error("Error fetching EA FC data from Steam:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch data from Steam API",
      error: error.message,
    });
  }
};
