// pages/ClusterDetailView.tsx (新建文件)
import React, { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';

interface ClusterDetailProps {
  clusterId: number;
  onBack: () => void;
}

export const ClusterDetailView: React.FC<ClusterDetailProps> = ({ clusterId, onBack }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/${clusterId}/reviews`)
      .then(res => res.json())
      .then(res => {
        setReviews(res.data);
        setLoading(false);
      });
  }, [clusterId]);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
        <ArrowLeft size={18} /> 返回问题列表
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold">问题原声详情 ({reviews.length}条)</h3>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            批量标记为已处理
          </button>
        </div>
        
        <div className="divide-y divide-slate-100">
          {reviews.map((rev: any) => (
            <div key={rev.id} className="p-4 hover:bg-slate-50">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-600 rounded">
                  {rev.country} - {rev.appId}
                </span>
                <span className="text-xs text-slate-400">{rev.date}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{rev.translated_text || rev.text}</p>
              {rev.original_content && (
                <p className="text-xs text-slate-400 mt-2 italic">原文: {rev.text}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};