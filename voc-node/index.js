import gplay from 'google-play-scraper';
import fs from 'fs';

// 配置项
const config = {
  appId: 'com.thai.credit.finance.reliable.loan.android', // SmartQarza 包名
  country: 'th',                   // 关键：强制指定巴基斯坦区
  language: 'en',                  // 界面语言设为英语
  sort: gplay.sort.NEWEST,         // 按最新排序 (也可以用 HELP FULNESS)
  num: 100                         // 这次先抓 100 条试试，最大支持一次抓几千条
};

console.log(`🚀 正在开始抓取 [${config.country}] 区的评论...`);

gplay.reviews(config)
  .then((response) => {
    // response.data 是评论数组
    const reviews = response.data;
    
    console.log(`✅ 成功抓取到 ${reviews.length} 条评论！`);
    
    // 打印第一条看看长什么样
    if (reviews.length > 0) {
      console.log('\n--- 最新一条评论示例 ---');
      console.log('用户:', reviews[0].userName);
      console.log('评分:', reviews[0].score);
      console.log('内容:', reviews[0].text);
      console.log('版本:', reviews[0].version);
      console.log('------------------------\n');
    }

    // 将结果保存为 result.json 文件，方便你打开看
    fs.writeFileSync('result.json', JSON.stringify(reviews, null, 2));
    console.log('💾 数据已保存到 result.json 文件中，请用编辑器打开查看。');
  })
  .catch((err) => {
    console.error('❌ 抓取失败:', err);
  });