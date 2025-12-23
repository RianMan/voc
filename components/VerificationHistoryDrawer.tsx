import React from 'react';
import { Drawer } from 'antd';
import { VerificationConfig, VerificationResult } from '../services/api';
import {formatDate} from '../tools/index'

interface Props {
  open: boolean;
  config: VerificationConfig | null;
  history: VerificationResult[];
  onClose: () => void;
  getConclusionText: (r: VerificationResult) => string;
}

export const VerificationHistoryDrawer: React.FC<Props> = ({
  open,
  config,
  history,
  onClose,
  getConclusionText
}) => {

  return (
    <Drawer
      title={`验证历史 - ${config?.issue_value || ''}`}
      width={720}
      open={open}
      onClose={onClose}
    >
      <div className="space-y-4">
        {history.map((result, index) => {
          const changePercent = Number(result.change_percent) || 0;

          return <div key={result.id} className="border rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-700 font-bold">
                  #{history.length - index}
                </span>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-500">
                    {formatDate(result.verify_date)} 
                  </span>
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      result.conclusion === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : result.conclusion === 'worsened'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {getConclusionText(result)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-slate-50 rounded p-3">
                    <div className="text-xs text-slate-500 mb-1">基准期</div>
                    <div className="text-lg font-bold">
                      {result.baseline_count} / {result.baseline_total}
                    </div>
                    <div className="text-xs text-slate-400">
                      {result.baseline_ratio && (result.baseline_ratio * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded p-3">
                    <div className="text-xs text-slate-500 mb-1">验证期</div>
                    <div className="text-lg font-bold">
                      {result.verify_count} / {result.verify_total}
                    </div>
                    <div className="text-xs text-slate-400">
                      {result.verify_ratio * 100 && (result.verify_ratio * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="text-center py-2 bg-slate-50 rounded">
                  <span
                    className={`text-xl font-bold ${
                      result.change_percent < 0
                        ? 'text-green-600'
                        : result.change_percent > 0
                        ? 'text-red-600'
                        : 'text-slate-600'
                    }`}
                  >
                    {changePercent > 0 ? '+' : ''}
                    {changePercent.toFixed(1)}%
                  </span>
                </div>

                {result.summary && (
                  <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                    <div className="text-xs text-amber-700 font-medium mb-1">
                      💡 分析总结
                    </div>
                    <p className="text-sm text-slate-700">
                      {result.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        })}
      </div>
    </Drawer>
  );
};
