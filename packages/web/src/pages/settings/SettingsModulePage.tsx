import { useParams } from 'react-router-dom';
import { SETTINGS_MODULES } from './SettingsLayout.js';
import { SettingsBody } from './settingsBodies.js';
import UserManagement from '../UserManagement.js';
import ReviewNotes from '../ReviewNotes.js';

export default function SettingsModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const mod = SETTINGS_MODULES.find(m => m.id === moduleId);

  if (moduleId === 'user-management') {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-cond)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{mod?.label}</h2>
        <UserManagement embedded />
      </div>
    );
  }

  if (moduleId === 'review-notes') {
    return (
      <div>
        <h2 style={{ fontFamily: 'var(--font-cond)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{mod?.label}</h2>
        <ReviewNotes embedded />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-cond)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        {mod?.label ?? 'Settings'}
      </h2>
      <SettingsBody moduleId={moduleId ?? ''} />
    </div>
  );
}
