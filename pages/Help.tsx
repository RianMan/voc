// pages/Help.tsx
import React from 'react';
import { 
  BookOpen, BarChart3, Wrench, Archive, Target, Layers, 
  DollarSign, Users, TrendingUp, CheckCircle, AlertTriangle,
  Clock, Send, Ban, Package, Bug, MessageSquare
} from 'lucide-react';

export const Help: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 顶部导航 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen size={32} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">VOC AI Agent 使用手册</h1>
            <p className="text-sm text-slate-500">系统功能介绍与操作指南</p>
          </div>
        </div>
        
        {/* 快速导航 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a href="#overview" className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <p className="font-medium text-blue-700 text-sm">系统概述</p>
          </a>
          <a href="#modules" className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <p className="font-medium text-blue-700 text-sm">功能模块</p>
          </a>
          <a href="#workflow" className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <p className="font-medium text-blue-700 text-sm">工作流程</p>
          </a>
          <a href="#faq" className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <p className="font-medium text-blue-700 text-sm">常见问题</p>
          </a>
        </div>
      </div>

      {/* 手册内容 */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="prose prose-slate max-w-none">
          <UserManualContent />
        </div>
      </div>
    </div>
  );
};

const UserManualContent: React.FC = () => {
  return (
    <>
      {/* 一、系统概述 */}
      <section id="overview" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500">一、系统概述</h2>
        <p className="text-slate-600 leading-relaxed">
          VOC AI Agent 是一个智能用户反馈分析平台，专为金融科技公司设计，支持多国市场（巴基斯坦、墨西哥、菲律宾、印尼、泰国）的用户反馈自动化处理。
          系统通过AI技术自动分析用户评论，识别问题类型、风险等级，并提供智能建议，帮助团队快速响应用户需求。
        </p>
      </section>

      {/* 二、核心功能模块 */}
      <section id="modules" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b-2 border-blue-500">二、核心功能模块</h2>
        
        {/* 1. 概览面板 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={24} className="text-blue-600" />
            <h3 className="text-xl font-semibold text-slate-800">1. 概览面板（Dashboard）</h3>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-blue-800 mb-2">功能：</p>
            <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
              <li>实时展示关键指标（总反馈数、高风险数、合规问题、技术Bug）</li>
              <li>问题分类饼图（合规风险/技术Bug/产品问题/其他）</li>
              <li>各国反馈量柱状图</li>
              <li>本周Top痛点榜（聚类结果摘要）</li>
              <li>闭环验证进度（已解决/改善/恶化）</li>
              <li>监控配置统计（活跃专题数、验证追踪数）</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-green-800 mb-2">使用场景：</p>
            <ul className="text-green-700 text-sm space-y-1 list-disc list-inside">
              <li>每日查看整体健康度</li>
              <li>快速识别高危问题</li>
              <li>了解各国市场反馈差异</li>
            </ul>
          </div>
        </div>

        {/* 2. 问题处理 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={24} className="text-amber-600" />
            <h3 className="text-xl font-semibold text-slate-800">2. 问题处理（Reports）⭐</h3>
          </div>
          
          <div className="bg-amber-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-amber-800 mb-2">功能：</p>
            <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
              <li><strong>筛选器</strong>：按App/分类/风险/状态/时间范围/关键词搜索</li>
              <li><strong>状态管理</strong>：待处理 → 已确认 → 已反馈 → 处理中 → 已解决，或标记为"无意义"</li>
              <li><strong>批量操作</strong>：选中多条问题批量更新状态</li>
              <li><strong>备注系统</strong>：给问题添加处理记录</li>
              <li><strong>状态历史</strong>：查看谁在何时改变了状态</li>
              <li><strong>一键生成周报</strong>：基于筛选结果生成AI周报</li>
            </ul>
          </div>

          <div className="bg-slate-100 p-4 rounded-lg my-4 border-l-4 border-amber-500">
            <p className="font-semibold text-slate-800 mb-2">典型流程：</p>
            <div className="flex items-center gap-2 text-sm text-slate-700 flex-wrap">
              <span className="bg-white px-3 py-1 rounded">1. 筛选高风险待处理问题</span>
              <span>→</span>
              <span className="bg-white px-3 py-1 rounded">2. 查看详情并添加备注</span>
              <span>→</span>
              <span className="bg-white px-3 py-1 rounded">3. 更新状态为"已确认"</span>
              <span>→</span>
              <span className="bg-white px-3 py-1 rounded">4. 反馈给产品团队</span>
              <span>→</span>
              <span className="bg-white px-3 py-1 rounded">5. 修复后标记"已解决"</span>
            </div>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-purple-800 mb-2">快捷操作：</p>
            <ul className="text-purple-700 text-sm space-y-1 list-disc list-inside">
              <li>点击行选中问题</li>
              <li>底部批量操作栏快速处理</li>
              <li>查看GP原文链接（直达Google Play）</li>
            </ul>
          </div>
        </div>

        {/* 3. 报告存档 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Archive size={24} className="text-purple-600" />
            <h3 className="text-xl font-semibold text-slate-800">3. 报告存档（Report Archive）</h3>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-purple-800 mb-2">功能：</p>
            <ul className="text-purple-700 text-sm space-y-1 list-disc list-inside">
              <li>浏览历史周报</li>
              <li>按App筛选报告</li>
              <li>时间线视图（显示新增/待处理/已解决趋势）</li>
              <li>查看完整报告内容（Markdown渲染）</li>
              <li>复制/下载报告</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-green-800 mb-2">使用场景：</p>
            <ul className="text-green-700 text-sm space-y-1 list-disc list-inside">
              <li>查看历史周报对比趋势</li>
              <li>向领导汇报时快速找到数据</li>
              <li>追溯某个问题的历史处理情况</li>
            </ul>
          </div>
        </div>

        {/* 4. 专题管理 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Target size={24} className="text-green-600" />
            <h3 className="text-xl font-semibold text-slate-800">4. 专题管理（Topic Manager）</h3>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-green-800 mb-2">功能：</p>
            <ul className="text-green-700 text-sm space-y-1 list-disc list-inside">
              <li><strong>创建专题</strong>：配置关键词监控（如"双十一活动"、"人脸识别失败"）</li>
              <li><strong>作用域控制</strong>：Global（全球）/ Country（特定国家）/ App（特定应用，优先级最高）</li>
              <li><strong>执行扫描</strong>：批量扫描历史评论，找出匹配的反馈</li>
              <li><strong>AI分析</strong>：对匹配到的反馈进行情感分析和痛点提炼</li>
              <li><strong>查看历史</strong>：追踪专题的长期趋势</li>
            </ul>
          </div>

          <div className="bg-slate-100 p-4 rounded-lg my-4 border-l-4 border-green-500">
            <p className="font-semibold text-slate-800 mb-3">使用场景示例：</p>
            
            <div className="mb-4 bg-white p-3 rounded">
              <p className="text-sm font-semibold text-slate-800 mb-2">场景1：监控营销活动</p>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside ml-2">
                <li>创建专题"双十一活动"，关键词：双十一、促销、优惠</li>
                <li>每天扫描，查看用户对活动的反馈</li>
                <li>AI分析提炼：好评率、痛点（如优惠券不能用）</li>
              </ul>
            </div>

            <div className="bg-white p-3 rounded">
              <p className="text-sm font-semibold text-slate-800 mb-2">场景2：追踪功能问题</p>
              <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside ml-2">
                <li>创建专题"人脸识别"，关键词：人脸、识别、验证</li>
                <li>定期分析情感变化</li>
                <li>验证产品修复后的效果</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 5. 聚类分析 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={24} className="text-red-600" />
            <h3 className="text-xl font-semibold text-slate-800">5. 聚类分析（Cluster Analysis）</h3>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-red-800 mb-2">功能：</p>
            <ul className="text-red-700 text-sm space-y-1 list-disc list-inside">
              <li><strong>自动聚类</strong>：AI将同类问题归类，生成Top痛点榜</li>
              <li><strong>按分类聚类</strong>：分别对Tech_Bug、Compliance_Risk、Product_Issue聚类</li>
              <li><strong>按App聚类</strong>：针对单个App进行聚类分析（不区分国家）</li>
              <li><strong>时间维度</strong>：按周生成聚类结果</li>
              <li><strong>详细信息</strong>：问题标题、涉及评论数、占比、根因分析、行动建议、用户原声</li>
            </ul>
          </div>

          <div className="bg-slate-100 p-4 rounded-lg my-4 border-l-4 border-red-500">
            <p className="font-semibold text-slate-800 mb-2">使用场景：</p>
            <div className="text-sm text-slate-700 space-y-2">
              <p className="font-medium">每周一查看聚类结果：</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>技术Bug Top5：短信验证码/人脸识别/App闪退...</li>
                <li>合规风险 Top5：催收投诉/威胁用户/骚扰电话...</li>
                <li>产品问题 Top5：还款流程复杂/额度太低/审核太慢...</li>
              </ul>
              <p className="mt-3 font-medium">产品会议：基于聚类结果排优先级</p>
            </div>
          </div>
        </div>

        {/* 6. 闭环验证 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={24} className="text-indigo-600" />
            <h3 className="text-xl font-semibold text-slate-800">6. 闭环验证（Verification Tracker）</h3>
          </div>
          
          <div className="bg-indigo-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-indigo-800 mb-2">功能：</p>
            <ul className="text-indigo-700 text-sm space-y-1 list-disc list-inside">
              <li><strong>快速创建验证</strong>：选择优化上线日期，系统自动计算基准期（前14天）</li>
              <li><strong>高级配置</strong>：手动指定基准期和验证期</li>
              <li><strong>验证类型</strong>：分类验证、关键词验证、聚类验证</li>
              <li><strong>自动判断</strong>：下降50%以上→已解决 / 下降20-50%→有改善 / 变化20%内→无明显变化 / 上升20%以上→恶化</li>
              <li><strong>批量验证</strong>：一键执行所有监控中的验证</li>
            </ul>
          </div>

          <div className="bg-slate-100 p-4 rounded-lg my-4 border-l-4 border-indigo-500">
            <p className="font-semibold text-slate-800 mb-2">使用场景：</p>
            <div className="text-sm text-slate-700 space-y-2">
              <div className="bg-white p-3 rounded">
                <p className="font-medium mb-2">1. 产品修复短信Bug后，创建验证：</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>问题类型：关键词</li>
                  <li>目标值：短信验证码</li>
                  <li>优化日期：2025-12-01</li>
                </ul>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="font-medium">2. 系统自动对比前后14天数据</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="font-medium">3. 每周执行验证，查看趋势</p>
              </div>
              <div className="bg-white p-3 rounded">
                <p className="font-medium">4. 如果恶化，立即通知产品团队</p>
              </div>
            </div>
          </div>
        </div>

        {/* 7. 费用统计 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={24} className="text-yellow-600" />
            <h3 className="text-xl font-semibold text-slate-800">7. 费用统计（Cost Overview）</h3>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-yellow-800 mb-2">功能：</p>
            <ul className="text-yellow-700 text-sm space-y-1 list-disc list-inside">
              <li>项目总投入（累计AI费用）</li>
              <li>本周新增费用</li>
              <li>单份周报平均成本</li>
              <li>费用构成分析（评论分析 vs 周报生成）</li>
              <li>详细列表（模型、Token消耗）</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-green-800 mb-2">使用场景：</p>
            <ul className="text-green-700 text-sm space-y-1 list-disc list-inside">
              <li>向管理层汇报AI成本</li>
              <li>优化AI调用策略</li>
              <li>预算规划</li>
            </ul>
          </div>
        </div>

        {/* 8. 用户管理 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users size={24} className="text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-800">8. 用户管理（User Management）</h3>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-lg my-4">
            <p className="font-semibold text-slate-800 mb-2">功能：</p>
            <ul className="text-slate-700 text-sm space-y-1 list-disc list-inside">
              <li>创建用户（用户名/密码/角色）</li>
              <li>角色权限：Admin（所有权限）/ Operator（处理问题、生成报告）/ Viewer（仅查看）</li>
              <li>禁用/启用用户</li>
              <li>修改密码和角色</li>
              <li>查看最后登录时间</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 三、典型工作流 */}
      <section id="workflow" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b-2 border-blue-500">三、典型工作流</h2>
        
        {/* 工作流1 */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-lg border-l-4 border-blue-500">
          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            工作流1：每日问题处理
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-mono">08:00</span>
              <span className="text-slate-700">登录系统，查看概览面板</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-mono">08:10</span>
              <span className="text-slate-700">进入"问题处理"，筛选高风险待处理</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-mono">08:30</span>
              <span className="text-slate-700">逐条查看，添加备注，更新状态</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-mono">09:00</span>
              <span className="text-slate-700">批量将确认的问题反馈给产品团队</span>
            </div>
          </div>
        </div>

        {/* 工作流2 */}
        <div className="mb-6 bg-gradient-to-r from-purple-50 to-purple-100 p-5 rounded-lg border-l-4 border-purple-500">
          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Archive size={20} className="text-purple-600" />
            工作流2：每周周报生成
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-mono">周五 16:00</span>
              <span className="text-slate-700">进入"问题处理"，选择当前App</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-mono">16:05</span>
              <span className="text-slate-700">点击"生成周报"，AI自动汇总本周数据</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-mono">16:08</span>
              <span className="text-slate-700">查看报告（包含概览/聚类Top痛点/闭环验证/行动建议）</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-mono">16:10</span>
              <span className="text-slate-700">复制报告，发送给团队</span>
            </div>
          </div>
        </div>

        {/* 工作流3 */}
        <div className="mb-6 bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-lg border-l-4 border-green-500">
          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Target size={20} className="text-green-600" />
            工作流3：专题监控
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">月初</span>
              <span className="text-slate-700">创建"双十一活动"专题</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">每天</span>
              <span className="text-slate-700">执行扫描，查看新匹配的反馈</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">每周</span>
              <span className="text-slate-700">执行AI分析，查看情感趋势</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">月末</span>
              <span className="text-slate-700">生成专题报告，评估活动效果</span>
            </div>
          </div>
        </div>

        {/* 工作流4 */}
        <div className="mb-6 bg-gradient-to-r from-indigo-50 to-indigo-100 p-5 rounded-lg border-l-4 border-indigo-500">
          <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle size={20} className="text-indigo-600" />
            工作流4：闭环验证
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">第1周</span>
              <span className="text-slate-700">产品修复Bug → 创建验证配置</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">第2周</span>
              <span className="text-slate-700">执行验证，查看数据变化</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">第3周</span>
              <span className="text-slate-700">再次验证，确认问题已解决</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">持续</span>
              <span className="text-slate-700">如果恶化，立即通知产品</span>
            </div>
          </div>
        </div>
      </section>

      {/* 四、系统亮点 */}
      <section id="highlights" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b-2 border-blue-500">四、系统亮点</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
              <Package size={20} />
              多数据源统一管理
            </h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>当前：Google Play评论</li>
              <li>即将：Udesk IM客服对话</li>
              <li>未来：可扩展任意数据源</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-lg border border-purple-200">
            <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
              <TrendingUp size={20} />
              AI深度分析
            </h4>
            <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
              <li>自动分类（Tech_Bug/Compliance_Risk等）</li>
              <li>风险评级（High/Medium/Low）</li>
              <li>根因分析 + 行动建议 + 建议回复</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-lg border border-green-200">
            <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle size={20} />
              闭环管理
            </h4>
            <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
              <li>从发现问题 → 确认 → 反馈 → 处理 → 验证解决</li>
              <li>完整的状态流转和历史追溯</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-lg border border-amber-200">
            <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
              <Archive size={20} />
              智能报告
            </h4>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>自动生成周报</li>
              <li>对比上周趋势</li>
              <li>引用聚类和验证结果</li>
              <li>给出可执行的行动建议</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 五、常见问题 */}
      <section id="faq" className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 pb-2 border-b-2 border-blue-500">五、常见问题</h2>
        
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-blue-600" />
              Q1：如何切换不同App？
            </h4>
            <p className="text-sm text-slate-600 ml-6">
              在页面顶部下拉框选择，所有数据会自动刷新。
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-blue-600" />
              Q2：如何批量处理问题？
            </h4>
            <p className="text-sm text-slate-600 ml-6">
              勾选多条问题，底部会出现批量操作栏，选择目标状态即可。
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-blue-600" />
              Q3：周报包含哪些内容？
            </h4>
            <p className="text-sm text-slate-600 ml-6">
              本周概览、处理记录、问题分布、高优先级问题深度剖析（含根因和建议）、对比上周、行动计划。
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-blue-600" />
              Q4：聚类分析多久执行一次？
            </h4>
            <p className="text-sm text-slate-600 ml-6">
              建议每周执行一次，可手动触发或定时任务。
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-blue-600" />
              Q5：闭环验证的基准期怎么确定？
            </h4>
            <p className="text-sm text-slate-600 ml-6">
              快速模式自动取优化前14天，高级模式可手动指定。
            </p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-blue-600" />
              Q6：聚类分析是按国家维度还是App维度？
            </h4>
            <p className="text-sm text-slate-600 ml-6">
              聚类分析是按<strong>单个App</strong>进行的，不区分国家。系统会自动汇总该App所有国家的反馈数据进行聚类。
            </p>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
        <p>如有其他问题，请联系系统管理员或产品团队</p>
        <p className="mt-2">VOC AI Agent v1.0 | © 2025</p>
      </div>
    </>
  );
};