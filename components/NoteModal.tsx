import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ReviewNote, StatusLog } from '../types';
import { X, MessageSquare, Send, Loader2, Clock, ArrowRight } from 'lucide-react';

interface NoteModalProps {
  reviewId: string;
  reviewSummary: string;
  onClose: () => void;
  onNoteAdded?: () => void;
}

export const NoteModal: React.FC<NoteModalProps> = ({ 
  reviewId, 
  reviewSummary, 
  onClose,
  onNoteAdded 
}) => {
  const { token, canEdit } = useAuth();
  const [notes, setNotes] = useState<ReviewNote[]>([]);
  const [history, setHistory] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'history'>('notes');

  useEffect(() => {
    loadData();
  }, [reviewId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载备注和历史
      const [notesRes, historyRes] = await Promise.all([
        fetch(`/api/voc/${encodeURIComponent(reviewId)}/notes`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }),
        fetch(`/api/voc/${encodeURIComponent(reviewId)}/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
      ]);
      
      const notesData = await notesRes.json();
      const historyData = await historyRes.json();
      
      if (notesData.success) setNotes(notesData.data || []);
      if (historyData.success) setHistory(historyData.data || []);
    } catch (e) {
      console.error('Load data failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !canEdit) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/voc/${encodeURIComponent(reviewId)}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: newNote.trim() })
      });
      
      if (res.ok) {
        setNewNote('');
        loadData();
        onNoteAdded?.();
      }
    } catch (e) {
      console.error('Add note failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: '待处理',
    irrelevant: '无意义',
    confirmed: '已确认',
    reported: '已反馈',
    in_progress: '处理中',
    resolved: '已解决',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-slate-800">问题详情</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-600 line-clamp-2">{reviewSummary}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'notes' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare size={16} className="inline mr-2" />
            备注 ({notes.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'history' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock size={16} className="inline mr-2" />
            操作记录 ({history.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          ) : activeTab === 'notes' ? (
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-center text-slate-400 py-8">暂无备注</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{note.user_name}</span>
                      <span className="text-xs text-slate-400">{formatDate(note.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-center text-slate-400 py-8">暂无操作记录</p>
              ) : (
                history.map(log => (
                  <div key={log.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-700">{log.user_name || 'system'}</span>
                        <span className="text-slate-400">将状态从</span>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                          {STATUS_LABELS[log.old_status] || log.old_status || '无'}
                        </span>
                        <ArrowRight size={12} className="text-slate-400" />
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {STATUS_LABELS[log.new_status] || log.new_status}
                        </span>
                      </div>
                      {log.note && (
                        <p className="text-slate-500 mt-1 text-xs">{log.note}</p>
                      )}
                      <p className="text-slate-400 text-xs mt-1">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Add Note Form */}
        {activeTab === 'notes' && canEdit && (
          <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="添加备注..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newNote.trim() || submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
