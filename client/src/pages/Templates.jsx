import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { api } from '../api/client';
import Skeleton from '../components/Skeleton';

const VARIABLES = ['{{customer_name}}', '{{cart_items}}', '{{discount_code}}'];

function TemplateEditor({ template, onSave }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(template.id, { subject, body, name: template.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 sm:p-6" style={{ borderColor: 'var(--panel-2)', background: 'var(--panel)' }}>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <div className="text-[11.5px] font-mono mb-0.5" style={{ color: 'var(--steel)' }}>Step {template.sequence_step}</div>
          <h3 className="font-display text-[15px]" style={{ color: 'var(--paper)' }}>{template.name}</h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md disabled:opacity-60"
          style={{ background: saved ? 'var(--moss)' : 'var(--amber)', color: 'var(--ink)' }}
        >
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <label className="block text-[12px] mb-1.5" style={{ color: 'var(--steel)' }}>Subject line</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="w-full rounded-md px-3 py-2 mb-4 text-[13.5px] outline-none"
        style={{ background: 'var(--panel-2)', color: 'var(--paper)' }}
      />

      <label className="block text-[12px] mb-1.5" style={{ color: 'var(--steel)' }}>Body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={7}
        className="w-full rounded-md px-3 py-2 text-[13.5px] outline-none resize-none font-mono"
        style={{ background: 'var(--panel-2)', color: 'var(--paper)' }}
      />
    </div>
  );
}

export default function Templates() {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.templates().then(setTemplates).catch((e) => setError(e.message));
  }, []);

  async function handleSave(id, payload) {
    const updated = await api.updateTemplate(id, payload);
    setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  if (error) return <div className="p-8 text-[14px]" style={{ color: 'var(--clay)' }}>{error}</div>;

  return (
    <div className="px-4 sm:px-8 py-7 max-w-3xl">
      <div className="mb-3">
        <h1 className="font-display text-[22px] font-semibold" style={{ color: 'var(--paper)' }}>Email templates</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--steel)' }}>Customize the recovery sequence sent to customers.</p>
      </div>

      <div className="flex items-start gap-2 mb-6 text-[12.5px] px-3 py-2.5 rounded-md" style={{ background: 'var(--panel-2)', color: 'var(--steel)' }}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>
          Available variables: {VARIABLES.map((v) => (
            <code key={v} className="font-mono px-1 py-0.5 rounded mx-0.5" style={{ background: 'var(--panel)', color: 'var(--paper)' }}>{v}</code>
          ))}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {!templates && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        {templates && templates.map((t) => (
          <TemplateEditor key={t.id} template={t} onSave={handleSave} />
        ))}
      </div>
    </div>
  );
}
