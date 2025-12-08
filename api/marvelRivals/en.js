const axios = require("axios");
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=1800");

  try {
    // رابط صفحة التحديثات الرسمي
    const url = "https://www.marvelrivals.com/news/";

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    const articles = [];

    // البحث عن العناصر بناءً على الكود الذي أرسلته (a.list-item)
    $("a.list-item").each((index, element) => {
      const linkAttr = $(element).attr("href");

      // التأكد من أن الرابط كامل
      const fullLink = linkAttr.startsWith("http")
        ? linkAttr
        : `https://www.marvelrivals.com${linkAttr}`;

      // استخراج الصورة من داخل div.img
      const imgElement = $(element).find(".img img");
      let imageUrl = imgElement.attr("src") || imgElement.attr("data-src");

      // استخراج النصوص من داخل div.text
      const textDiv = $(element).find(".text");
      const title = textDiv.find("h2").text().trim();
      const description = textDiv.find("p").text().trim();

      // محاولة استخراج التاريخ من الرابط أو العنوان لأن الكارد لا يحتوي على عنصر تاريخ صريح
      // مثال الرابط: .../20251203/...
      let date = new Date().toISOString();
      const dateMatch = fullLink.match(/\/(\d{8})\//); // يبحث عن 8 أرقام في الرابط
      if (dateMatch && dateMatch[1]) {
        const dStr = dateMatch[1];
        // تحويل YYYYMMDD إلى تاريخ
        date = new Date(
          `${dStr.slice(0, 4)}-${dStr.slice(4, 6)}-${dStr.slice(6, 8)}`
        ).toISOString();
      }

      if (title && fullLink) {
        articles.push({
          title,
          category: "Game Update",
          date,
          description,
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
    console.error("Error scraping Marvel Rivals data:", error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to scrape data",
      error: error.message,
    });
  }
};
