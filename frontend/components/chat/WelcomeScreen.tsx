"use client";

interface WelcomeScreenProps {
  questions: string[];
  onSelect: (q: string) => void;
  loading?: boolean;
}

export function WelcomeScreen({ questions, onSelect, loading }: WelcomeScreenProps) {
  const defaultQuestions = [
    "上月销售额与环比增长情况",
    "本月营收趋势分析",
    "哪个产品/渠道表现最好",
    "下个月的销售预测",
  ];

  const displayQuestions = questions.length > 0 ? questions : defaultQuestions;

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-scale-in">
      <div className="relative mb-8">
        <div className="absolute -inset-8 bg-indigo-500/10 rounded-full blur-2xl animate-float-orb" />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/25 card-shimmer-border">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        </div>
      </div>

      <h2 className="text-3xl font-bold text-gradient mb-2 tracking-tight">有什么数据问题?</h2>
      <p className="text-zinc-500 text-sm mb-10 max-w-md text-center leading-relaxed">
        上传数据文件或直接提问，我将为你提供深度分析洞察与可视化建议
      </p>

      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl w-full px-4">
        {displayQuestions.map((q, i) => (
          <button
            key={`suggestion-${i}`}
            onClick={() => onSelect(q)}
            className={`group relative p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/40 text-left text-sm text-zinc-400 hover:text-zinc-100 hover:border-indigo-500/30 hover:bg-zinc-800/40 transition-all duration-300 hover-lift overflow-hidden${loading ? " opacity-70" : ""}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="absolute inset-0 card-inner-glow opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-md bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </span>
              <span className="leading-relaxed">{q}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
