import { usePomodoroTimer } from "@/hooks/usePomodoroTimer";
import { cn } from "@/lib/utils";

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

function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
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

const PomodoroPage = () => {
  const { settings, updateSettings, resetDefaults } = usePomodoroTimer();

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto px-6 py-6">

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-400">工具栏快捷键</h3>
        <div className="divide-y divide-indigo-100/60 text-sm">
          {[
            { label: "开始专注",    keys: ["Alt", "1"] },
            { label: "开始短休息", keys: ["Alt", "2"] },
            { label: "开始长休息", keys: ["Alt", "3"] },
            { label: "暂停 / 继续", keys: ["Alt", "Space"] },
            { label: "停止计时器", keys: ["Alt", "0"] },
          ].map(({ label, keys }) => (
            <div key={label} className="flex items-center justify-between py-2">
              <span className="text-slate-600">{label}</span>
              <KbdShortcut keys={keys} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-indigo-400">倒计时显示在工具栏输入框内部，需工具栏窗口获得焦点。</p>
      </section>

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
