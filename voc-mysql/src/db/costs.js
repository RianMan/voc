import pool from './connection.js';

// ==================== 价格配置 ====================
const PRICING = {
  deepseek: { input: 2.0, output: 3.0 },
  qwen: { input: 3.2, output: 12.8 }
};

// ==================== AI费用记录 ====================

export async function recordAICost(provider, model, type, usage) {
  if (!usage) return 0;

  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  
  const prices = provider.includes('qwen') || provider.includes('aliyun') 
    ? PRICING.qwen 
    : PRICING.deepseek;

  const cost = (input / 1000000 * prices.input) + (output / 1000000 * prices.output);

  await pool.execute(
    `INSERT INTO ai_costs (provider, model, operation_type, input_tokens, output_tokens, total_cost)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [provider, model, type, input, output, cost]
  );
  
  return cost;
}

export async function getCostStats() {
  const [totalRows] = await pool.execute('SELECT SUM(total_cost) as total FROM ai_costs');
  
  const [weeklyRows] = await pool.execute(`
    SELECT SUM(total_cost) as total 
    FROM ai_costs 
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
  `);

  const [byTypeRows] = await pool.execute(`
    SELECT operation_type, SUM(total_cost) as cost, SUM(output_tokens) as tokens
    FROM ai_costs 
    GROUP BY operation_type
  `);

  return {
    total: totalRows[0]?.total || 0,
    weekly: weeklyRows[0]?.total || 0,
    breakdown: byTypeRows
  };
}