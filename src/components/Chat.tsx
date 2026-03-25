import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { handleChat, executeAction } from '../services/geminiService';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      parts: [{ text: 'আসসালামু আলাইকুম। আমি "এক টুকরো হোমনা" এর পক্ষ থেকে আপনাকে সাহায্য করতে এসেছি। আপনি কি রক্ত খুঁজছেন নাকি রক্তদাতা হিসেবে নিবন্ধন করতে চান?' }]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ name: string, args: any } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || pendingAction) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', parts: [{ text: userMessage }] }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: m.parts
      }));
      
      const result = await handleChat(userMessage, history);
      
      if (result.pendingAction) {
        setPendingAction(result.pendingAction);
      }
      
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: result.text || '' }] }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'দুঃখিত, কোনো সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsLoading(true);
    try {
      const result = await executeAction(pendingAction);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: result.message }] }]);
      setPendingAction(null);
    } catch (error) {
      console.error('Action error:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'দুঃখিত, তথ্যটি সংরক্ষণ করতে সমস্যা হয়েছে।' }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'ঠিক আছে, আমি এটি বাতিল করেছি। আমি আপনাকে আর কিভাবে সাহায্য করতে পারি?' }] }]);
  };

  return (
    <div className="flex flex-col h-[500px] sm:h-[600px] w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative">
      <div className="bg-red-600 p-4 text-white flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Bot size={24} />
        </div>
        <div>
          <h2 className="font-semibold text-lg">এক টুকরো হোমনা</h2>
          <p className="text-red-100 text-xs">রক্তদান সহকারী</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex gap-3 max-w-[80%] ${
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-red-100 text-red-600' : 'bg-white text-red-600 shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div
                  className={`p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    <Markdown>
                      {msg.parts[0].text}
                    </Markdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-white text-red-600 shadow-sm flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 rounded-tl-none">
                <Loader2 size={18} className="animate-spin text-red-600" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Inline Confirmation for Chat */}
      <AnimatePresence>
        {pendingAction && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-4 right-4 bg-white border border-red-100 shadow-2xl rounded-2xl p-4 z-10"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full text-red-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">নিশ্চিত করুন</h4>
                <p className="text-xs text-slate-500">
                  {pendingAction.name === 'save_blood_request' 
                    ? `রক্তের আবেদন: ${pendingAction.args.bloodGroup}, ${pendingAction.args.location}`
                    : `রক্তদাতা নিবন্ধন: ${pendingAction.args.name}, ${pendingAction.args.bloodGroup}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelAction}
                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                বাতিল
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isLoading}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                হ্যাঁ, নিশ্চিত
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pendingAction ? "আগে নিশ্চিত করুন..." : "আপনার বার্তা লিখুন..."}
          className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
          disabled={isLoading || !!pendingAction}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !!pendingAction}
          className="bg-red-600 text-white p-2 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
