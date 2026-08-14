import { usePomodoroTimer } from "@/hooks/usePomodoroTimer";
import { cn } from "@/lib/utils";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-indigo-600" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({
  value, min, max, onChange,
}: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number" min={min} max={max} value={value}
      onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= min && v <= max) onChange(v); }}
      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-800 focus:border-indigo-400 focus:outline-none"
    />
  );
}

function KbdShortcut({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-0.5">
      {keys.map((k, i) => (
        <kbd key={i} className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">{k}</kbd>
      ))}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PomodoroPage = () => {
  const { settings, updateSettings, resetDefaults } = usePomodoroTimer();

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 py-6">

      {/* Keyboard shortcuts reference */}
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-400">工具栏快捷键</h3>
        <div className="divide-y divide-indigo-100/60 text-sm">
          {[
            { label: "开始专注",       keys: ["Alt", "1"] },
            { label: "开始短休息",     keys: ["Alt", "2"] },
            { label: "开始长休息",     keys: ["Alt", "3"] },
            { label: "暂停 / 继续",    keys: ["Alt", "Space"] },
            { label: "停止计时器",     keys: ["Alt", "0"] },
          ].map(({ label, keys }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="text-slate-600">{label}</span>
              <KbdShortcut keys={keys} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-indigo-400">倒计时显示在工具栏输入框上方，需工具栏窗口获得焦点。</p>
      </section>

      {/* Time settings */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">时间设置</h3>
        <div className="divide-y divide-slate-50">
          <SettingRow label="专注时长（分钟）">
            <NumberInput value={settings.timeWork} min={1} max={90} onChange={(v) => updateSettings({ timeWork: v })} />
          </SettingRow>
          <SettingRow label="短休息时长（秒）">
            <NumberInput value={settings.timeShortBreak} min={10} max={600} onChange={(v) => updateSettings({ timeShortBreak: v })} />
          </SettingRow>
          <SettingRow label="长休息时长（分钟）">
            <NumberInput value={settings.timeLongBreak} min={1} max={60} onChange={(v) => updateSettings({ timeLongBreak: v })} />
          </SettingRow>
          <SettingRow label="长休息前轮次">
            <NumberInput value={settings.workRounds} min={1} max={10} onChange={(v) => updateSettings({ workRounds: v })} />
          </SettingRow>
        </div>
      </section>

      {/* Auto-start */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">自动切换</h3>
        <div className="divide-y divide-slate-50">
          <SettingRow label="自动开始休息">
            <Toggle checked={settings.autoStartBreak} onChange={(v) => updateSettings({ autoStartBreak: v })} />
          </SettingRow>
          <SettingRow label="自动开始专注">
            <Toggle checked={settings.autoStartWork} onChange={(v) => updateSettings({ autoStartWork: v })} />
          </SettingRow>
        </div>
      </section>

      {/* Sound */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">声音</h3>
        <div className="divide-y divide-slate-50">
          <SettingRow label="完成提示音">
            <Toggle checked={settings.alertSounds} onChange={(v) => updateSettings({ alertSounds: v })} />
          </SettingRow>
          <SettingRow label="专注时滴答声">
            <Toggle checked={settings.tickSounds} onChange={(v) => updateSettings({ tickSounds: v })} />
          </SettingRow>
          <SettingRow label="休息时滴答声">
            <Toggle checked={settings.tickSoundsDuringBreak} onChange={(v) => updateSettings({ tickSoundsDuringBreak: v })} />
          </SettingRow>
          <SettingRow label={`音量  ${settings.volume}%`}>
            <input type="range" min={0} max={100} value={settings.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
              className="w-28 accent-indigo-600" />
          </SettingRow>
        </div>
      </section>

      {/* Display */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">显示</h3>
        <div className="divide-y divide-slate-50">
          <SettingRow label="休息时全屏显示">
            <Toggle checked={settings.fullscreenBreak} onChange={(v) => updateSettings({ fullscreenBreak: v })} />
          </SettingRow>
        </div>
      </section>

      <button type="button" onClick={resetDefaults}
        className="self-start rounded-xl border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50">
        恢复默认设置
      </button>
    </div>
  );
};

export default PomodoroPage;


// ─── Constants ────────────────────────────────────────────────────────────────

const RING_R = 86;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

const TABS: { key: PomodoroRound; label: string; color: string }[] = [
  { key: "work",        label: "专注",   color: "#ef4444" },
  { key: "short-break", label: "短休息", color: "#10b981" },
  { key: "long-break",  label: "长休息", color: "#3b82f6" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-indigo-600" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-600">{label}</span>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm text-slate-800 focus:border-indigo-400 focus:outline-none"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PomodoroPage = () => {
  const timer = usePomodoroTimer();
  const { settings, updateSettings } = timer;

  const [activeTab, setActiveTab] = useState<PomodoroRound>("work");

  const displayTab = timer.timerStarted ? timer.currentRound : activeTab;
  const activeColor = TABS.find((t) => t.key === displayTab)?.color ?? "#ef4444";

  const ringOffset =
    timer.timerStarted && timer.currentRound === displayTab && timer.totalTime > 0
      ? RING_CIRCUMFERENCE * (timer.timeRemaining / timer.totalTime)
      : RING_CIRCUMFERENCE;

  const handleMainButton = () => {
    if (!timer.timerStarted) {
      timer.startTimer(displayTab === "off" ? "work" : displayTab);
    } else if (timer.isRunning) {
      timer.pauseTimer();
    } else {
      timer.resumeTimer();
    }
  };

  const handleTabClick = (tab: PomodoroRound) => {
    if (timer.isRunning) return;
    setActiveTab(tab);
    if (timer.timerStarted) timer.stopTimer();
  };

  const showFullscreen =
    settings.fullscreenBreak &&
    timer.timerStarted &&
    (timer.currentRound === "short-break" || timer.currentRound === "long-break");

  return (
    <>
      {/* Fullscreen break overlay */}
      {showFullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: activeColor + "22" }}
        >
          <div className="text-6xl font-mono font-bold" style={{ color: activeColor }}>
            {timer.formattedTime}
          </div>
          <div className="mt-3 text-lg font-semibold text-slate-600">
            {timer.currentRound === "short-break" ? "短休息" : "长休息"}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => timer.pauseTimer()}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              暂停
            </button>
            <button
              onClick={() => timer.stopTimer()}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              结束
            </button>
          </div>
        </div>
      )}

      <div className="flex h-full w-full gap-6 overflow-y-auto px-6 py-6">
        {/* ── LEFT: Timer ── */}
        <div className="flex w-72 flex-shrink-0 flex-col items-center gap-5">
          {/* Tabs */}
          <div className="flex w-full gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabClick(tab.key)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all",
                  displayTab === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Dial */}
          <div className="relative" style={{ width: 200, height: 200 }}>
            <svg viewBox="0 0 200 200" width={200} height={200} className="absolute inset-0 -rotate-90">
              <circle cx="100" cy="100" r={RING_R} fill="none" stroke="#f0f0f0" strokeWidth={8} />
              <circle
                cx="100"
                cy="100"
                r={RING_R}
                fill="none"
                stroke={activeColor}
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.3s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-bold tracking-tight text-slate-900">
                {timer.formattedTime}
              </span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: activeColor }}>
                {TABS.find((t) => t.key === displayTab)?.label ?? "专注"}
              </span>
              <span className="mt-0.5 text-[11px] text-slate-400">
                {timer.round} / {settings.workRounds} 轮
              </span>
            </div>
          </div>

          {/* Main control */}
          <button
            type="button"
            onClick={handleMainButton}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background: activeColor }}
          >
            {!timer.timerStarted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="8,5 8,19 19,12" />
              </svg>
            ) : timer.isRunning ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="8,5 8,19 19,12" />
              </svg>
            )}
          </button>

          {/* Secondary controls */}
          {timer.timerStarted && (
            <div className="flex gap-2">
              <button onClick={() => timer.resetTimer()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">重置</button>
              <button onClick={() => timer.skipTimer()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">跳过</button>
              <button onClick={() => timer.stopTimer()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">停止</button>
            </div>
          )}

          {/* Stats */}
          <div className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{timer.totalWorkRounds}</div>
            <div className="text-xs text-slate-400">今日完成轮次</div>
          </div>
        </div>

        {/* ── RIGHT: Settings ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
          {/* Time settings */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">时间设置</h3>
            <div className="divide-y divide-slate-50">
              <SettingRow label="专注时长（分钟）">
                <NumberInput value={settings.timeWork} min={1} max={90} onChange={(v) => updateSettings({ timeWork: v })} />
              </SettingRow>
              <SettingRow label="短休息时长（秒）">
                <NumberInput value={settings.timeShortBreak} min={10} max={600} onChange={(v) => updateSettings({ timeShortBreak: v })} />
              </SettingRow>
              <SettingRow label="长休息时长（分钟）">
                <NumberInput value={settings.timeLongBreak} min={1} max={60} onChange={(v) => updateSettings({ timeLongBreak: v })} />
              </SettingRow>
              <SettingRow label="长休息前轮次">
                <NumberInput value={settings.workRounds} min={1} max={10} onChange={(v) => updateSettings({ workRounds: v })} />
              </SettingRow>
            </div>
          </section>

          {/* Auto-start */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">自动切换</h3>
            <div className="divide-y divide-slate-50">
              <SettingRow label="自动开始休息">
                <Toggle checked={settings.autoStartBreak} onChange={(v) => updateSettings({ autoStartBreak: v })} />
              </SettingRow>
              <SettingRow label="自动开始专注">
                <Toggle checked={settings.autoStartWork} onChange={(v) => updateSettings({ autoStartWork: v })} />
              </SettingRow>
            </div>
          </section>

          {/* Sound */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">声音</h3>
            <div className="divide-y divide-slate-50">
              <SettingRow label="完成提示音">
                <Toggle checked={settings.alertSounds} onChange={(v) => updateSettings({ alertSounds: v })} />
              </SettingRow>
              <SettingRow label="专注时滴答声">
                <Toggle checked={settings.tickSounds} onChange={(v) => updateSettings({ tickSounds: v })} />
              </SettingRow>
              <SettingRow label="休息时滴答声">
                <Toggle checked={settings.tickSoundsDuringBreak} onChange={(v) => updateSettings({ tickSoundsDuringBreak: v })} />
              </SettingRow>
              <SettingRow label={`音量  ${settings.volume}%`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.volume}
                  onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
                  className="w-28 accent-indigo-600"
                />
              </SettingRow>
            </div>
          </section>

          {/* Display */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">显示</h3>
            <div className="divide-y divide-slate-50">
              <SettingRow label="休息时全屏显示">
                <Toggle checked={settings.fullscreenBreak} onChange={(v) => updateSettings({ fullscreenBreak: v })} />
              </SettingRow>
            </div>
          </section>

          <button
            type="button"
            onClick={() => timer.resetDefaults()}
            className="self-start rounded-xl border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:bg-slate-50"
          >
            恢复默认设置
          </button>
        </div>
      </div>
    </>
  );
};

export default PomodoroPage;
